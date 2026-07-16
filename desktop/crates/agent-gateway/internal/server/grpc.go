package server

import (
	"context"
	"errors"
	"io"
	"time"

	"github.com/google/uuid"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/liveagent/agent-gateway/internal/auth"
	"github.com/liveagent/agent-gateway/internal/config"
	gatewayv1 "github.com/liveagent/agent-gateway/internal/proto/v1"
	"github.com/liveagent/agent-gateway/internal/session"
)

type GRPCServer struct {
	gatewayv1.UnimplementedAgentGatewayServer

	cfg     *config.Config
	tenants *session.Tenants
}

func NewGRPCServer(cfg *config.Config, sm *session.Manager) *GRPCServer {
	return NewTenantGRPCServer(cfg, session.SingleTenant(sm))
}

// BOXAI: NewTenantGRPCServer scopes each agent link to the tenant its token
// resolves to, so one hosted gateway can serve many boxAI accounts.
func NewTenantGRPCServer(cfg *config.Config, tenants *session.Tenants) *GRPCServer {
	return &GRPCServer{
		cfg:     cfg,
		tenants: tenants,
	}
}

// managerFromContext resolves the caller's tenant manager from gRPC metadata.
// The stream interceptor already rejected invalid tokens, so in single-tenant
// mode an unresolvable identity still lands on the shared manager.
func (s *GRPCServer) managerFromContext(ctx context.Context) *session.Manager {
	identity, _ := auth.ResolveGRPCContext(ctx, s.cfg.Token)
	return s.tenants.ManagerFor(identity.TenantID())
}

func (s *GRPCServer) Authenticate(_ context.Context, req *gatewayv1.AuthRequest) (*gatewayv1.AuthResponse, error) {
	// BOXAI: ResolveToken accepts the static shared token or, when
	// configured, a boxAI account JWT (verified via /api/v1/auth/me).
	identity, ok := auth.ResolveToken(req.GetToken(), s.cfg.Token)
	if !ok {
		return &gatewayv1.AuthResponse{
			Success: false,
			Message: "invalid token",
		}, nil
	}
	sm := s.tenants.ManagerFor(identity.TenantID())
	if sm == nil {
		return &gatewayv1.AuthResponse{
			Success: false,
			Message: "invalid token",
		}, nil
	}

	sessionID := uuid.NewString()
	sm.RecordAuthentication(req.GetAgentId(), req.GetAgentVersion(), sessionID)

	return &gatewayv1.AuthResponse{
		Success:   true,
		Message:   "ok",
		SessionId: sessionID,
	}, nil
}

func (s *GRPCServer) AgentConnect(stream gatewayv1.AgentGateway_AgentConnectServer) error {
	sm := s.managerFromContext(stream.Context())
	if sm == nil {
		return status.Error(codes.Unauthenticated, "invalid token")
	}
	authSnapshot := sm.LatestAuthSnapshot()
	sess := session.NewAgentSession(authSnapshot)
	toAgent := sess.Outbound()
	sm.SetSession(sess)
	defer sm.ClearSession(sess)

	ctx, cancel := context.WithCancel(stream.Context())
	defer cancel()

	go s.heartbeatLoop(ctx, sm, sess)
	go func() {
		select {
		case <-ctx.Done():
		case <-sess.Done():
			cancel()
		}
	}()

	pings := sess.Pings()
	sendErrCh := make(chan error, 1)
	go func() {
		for {
			// Heartbeats jump the shared data queue so congestion can never
			// starve them.
			select {
			case ping := <-pings:
				if err := stream.Send(ping); err != nil {
					sendErrCh <- err
					cancel()
					return
				}
				continue
			default:
			}
			select {
			case <-ctx.Done():
				sendErrCh <- ctx.Err()
				return
			case <-sess.Done():
				sendErrCh <- nil
				cancel()
				return
			case ping := <-pings:
				if err := stream.Send(ping); err != nil {
					sendErrCh <- err
					cancel()
					return
				}
			case outbound := <-toAgent:
				if outbound == nil || outbound.GatewayEnvelope == nil {
					continue
				}
				select {
				case <-outbound.Context().Done():
					outbound.Ack(outbound.Context().Err())
					continue
				default:
				}
				if err := stream.Send(outbound.GatewayEnvelope); err != nil {
					outbound.Ack(err)
					sendErrCh <- err
					cancel()
					return
				}
				outbound.Ack(nil)
			}
		}
	}()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case err := <-sendErrCh:
			if err == nil || err == context.Canceled {
				return nil
			}
			return err
		default:
		}

		env, err := stream.Recv()
		if err != nil {
			if err == io.EOF {
				return nil
			}
			return err
		}

		// Any inbound envelope proves the agent is alive; a streaming agent
		// must never be declared heartbeat-stale.
		sm.TouchHeartbeat(sess)
		// Pongs flow through the same dispatch as every other envelope:
		// correlated probes registered a request stream before sending their
		// Ping and match by request_id, while periodic heartbeat Pongs have
		// no registered stream and are harmlessly ignored there.
		sm.DispatchFromAgentForSession(sess, env)
	}
}

func (s *GRPCServer) AgentTerminalConnect(stream gatewayv1.AgentGateway_AgentTerminalConnectServer) error {
	sm := s.managerFromContext(stream.Context())
	if sm == nil {
		return status.Error(codes.Unauthenticated, "invalid token")
	}
	toAgent := make(chan *gatewayv1.TerminalStreamFrame, 4096)
	cleanup := sm.RegisterTerminalStreamToAgent(toAgent)
	defer cleanup()

	ctx, cancel := context.WithCancel(stream.Context())
	defer cancel()

	if err := stream.Send(gatewayTerminalStreamReadyFrame()); err != nil {
		return err
	}

	sendErrCh := make(chan error, 1)
	recvErrCh := make(chan error, 1)
	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case frame := <-toAgent:
				if frame == nil {
					continue
				}
				if err := stream.Send(frame); err != nil {
					sendErrCh <- err
					cancel()
					return
				}
			}
		}
	}()

	go func() {
		frame, err := stream.Recv()
		for err == nil {
			sm.BroadcastTerminalStreamFrame(frame)
			frame, err = stream.Recv()
		}
		if err == io.EOF {
			recvErrCh <- nil
		} else {
			recvErrCh <- err
		}
		cancel()
	}()

	for {
		select {
		case <-ctx.Done():
			if errors.Is(ctx.Err(), context.Canceled) {
				return nil
			}
			return ctx.Err()
		case err := <-sendErrCh:
			cancel()
			if err == nil || errors.Is(err, context.Canceled) {
				return nil
			}
			return err
		case err := <-recvErrCh:
			cancel()
			if err == nil || errors.Is(err, context.Canceled) {
				return nil
			}
			return err
		}
	}
}

func gatewayTerminalStreamReadyFrame() *gatewayv1.TerminalStreamFrame {
	return &gatewayv1.TerminalStreamFrame{
		Kind:     "detach",
		StreamId: "gateway-ready-" + uuid.NewString(),
	}
}

func (s *GRPCServer) heartbeatLoop(ctx context.Context, sm *session.Manager, sess *session.AgentSession) {
	period := s.heartbeatPeriod()
	ticker := time.NewTicker(period)
	defer ticker.Stop()

	if !s.sendHeartbeat(sess) {
		return
	}

	timeout := period * 3
	for {
		select {
		case <-ctx.Done():
			return
		case <-sess.Done():
			return
		case <-ticker.C:
			if sm.ClearSessionIfHeartbeatStale(sess, timeout) {
				return
			}
			if !s.sendHeartbeat(sess) {
				return
			}
		}
	}
}

func (s *GRPCServer) heartbeatPeriod() time.Duration {
	if s.cfg == nil || s.cfg.HeartbeatPeriod <= 0 {
		return 30 * time.Second
	}
	return s.cfg.HeartbeatPeriod
}

func (s *GRPCServer) sendHeartbeat(sess *session.AgentSession) bool {
	return sess.SendPing(&gatewayv1.GatewayEnvelope{
		RequestId: "ping-" + uuid.NewString(),
		Timestamp: time.Now().Unix(),
		Payload: &gatewayv1.GatewayEnvelope_Ping{
			Ping: &gatewayv1.PingRequest{
				Timestamp: time.Now().Unix(),
			},
		},
	}) == nil
}
