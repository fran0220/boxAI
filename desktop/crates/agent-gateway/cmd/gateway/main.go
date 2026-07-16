package main

import (
	"context"
	"errors"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/keepalive"
	"google.golang.org/grpc/reflection"

	"github.com/liveagent/agent-gateway/internal/auth"
	"github.com/liveagent/agent-gateway/internal/config"
	gatewayv1 "github.com/liveagent/agent-gateway/internal/proto/v1"
	"github.com/liveagent/agent-gateway/internal/server"
	"github.com/liveagent/agent-gateway/internal/session"
)

const grpcShutdownTimeout = 3 * time.Second

func main() {
	cfg := config.Load()
	// BOXAI: enable boxAI account-JWT auth fallback when a server is configured.
	auth.ConfigureBoxAI(cfg.BoxAIServerURL)
	if cfg.BoxAIServerURL != "" {
		log.Printf("boxAI account token validation enabled against %s", cfg.BoxAIServerURL)
	}
	// BOXAI: hosted deployments isolate sessions per boxAI account.
	tenants := session.SingleTenant(session.NewManager())
	if cfg.MultiTenant {
		tenants = session.NewTenants()
		log.Printf("multi-tenant mode enabled: sessions are isolated per boxAI account")
	}

	grpcServer, err := newGRPCServer(cfg, tenants)
	if err != nil {
		log.Fatalf("create gRPC server: %v", err)
	}

	grpcListener, err := net.Listen("tcp", cfg.GRPCAddr)
	if err != nil {
		log.Fatalf("listen gRPC: %v", err)
	}

	httpServer := &http.Server{
		Addr:              cfg.HTTPAddr,
		Handler:           server.NewTenantHTTPServer(cfg, tenants),
		ReadHeaderTimeout: 10 * time.Second,
	}

	errCh := make(chan error, 2)

	go func() {
		log.Printf("gRPC listening on %s", cfg.GRPCAddr)
		if serveErr := grpcServer.Serve(grpcListener); serveErr != nil && !errors.Is(serveErr, grpc.ErrServerStopped) {
			errCh <- serveErr
		}
	}()

	go func() {
		log.Printf("HTTP listening on %s", cfg.HTTPAddr)
		var serveErr error
		if cfg.TLSCert != "" || cfg.TLSKey != "" {
			serveErr = httpServer.ListenAndServeTLS(cfg.TLSCert, cfg.TLSKey)
		} else {
			serveErr = httpServer.ListenAndServe()
		}
		if serveErr != nil && !errors.Is(serveErr, http.ErrServerClosed) {
			errCh <- serveErr
		}
	}()

	signalCh := make(chan os.Signal, 1)
	signal.Notify(signalCh, syscall.SIGINT, syscall.SIGTERM)

	select {
	case sig := <-signalCh:
		log.Printf("received signal %s, shutting down", sig)
	case err := <-errCh:
		log.Fatalf("server error: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	httpShutdownErrCh := make(chan error, 1)
	go func() {
		httpShutdownErrCh <- httpServer.Shutdown(ctx)
	}()

	if forced := shutdownGRPCServer(grpcServer, grpcShutdownTimeout); forced {
		log.Printf("gRPC graceful shutdown timed out after %s, forcing stop", grpcShutdownTimeout)
	}

	if err := <-httpShutdownErrCh; err != nil {
		log.Printf("http shutdown error: %v", err)
	}
}

func newGRPCServer(cfg *config.Config, tenants *session.Tenants) (*grpc.Server, error) {
	options := []grpc.ServerOption{
		grpc.MaxRecvMsgSize(cfg.GRPCMaxMessageBytes),
		grpc.MaxSendMsgSize(cfg.GRPCMaxMessageBytes),
		grpc.UnaryInterceptor(auth.GRPCUnaryInterceptor(cfg.Token)),
		grpc.StreamInterceptor(auth.GRPCStreamInterceptor(cfg.Token)),
		// Transport-level liveness: h2 PINGs are not subject to application
		// queue congestion, so dead links are detected even mid-stream.
		grpc.KeepaliveParams(keepalive.ServerParameters{
			Time:    30 * time.Second,
			Timeout: 10 * time.Second,
		}),
		// The desktop GUI pings every 10-60s; MinTime must stay below its
		// floor or grpc-go answers with a too_many_pings GOAWAY.
		grpc.KeepaliveEnforcementPolicy(keepalive.EnforcementPolicy{
			MinTime:             5 * time.Second,
			PermitWithoutStream: true,
		}),
	}
	if cfg.TLSCert != "" || cfg.TLSKey != "" {
		creds, err := credentials.NewServerTLSFromFile(cfg.TLSCert, cfg.TLSKey)
		if err != nil {
			return nil, err
		}
		options = append(options, grpc.Creds(creds))
	}

	grpcServer := grpc.NewServer(options...)
	gatewayv1.RegisterAgentGatewayServer(grpcServer, server.NewTenantGRPCServer(cfg, tenants))
	reflection.Register(grpcServer)
	return grpcServer, nil
}
