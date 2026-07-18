// BOXAI: tests for tenant isolation on the browser WebSocket surface.
package websocket_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/liveagent/agent-gateway/internal/auth"
	"github.com/liveagent/agent-gateway/internal/config"
	"github.com/liveagent/agent-gateway/internal/server"
	"github.com/liveagent/agent-gateway/internal/session"
)

// dialGatewayWebSocketPath dials /ws on a full gateway mux (the shared helper
// dials the handler root, which only works for bare WebSocket handlers).
func dialGatewayWebSocketPath(t *testing.T, handler http.Handler) (*websocket.Conn, func()) {
	t.Helper()
	ts := httptest.NewServer(handler)
	wsURL := "ws" + strings.TrimPrefix(ts.URL, "http") + "/ws"
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, http.Header{
		"Origin": []string{ts.URL},
	})
	if err != nil {
		ts.Close()
		t.Fatalf("dial websocket: %v", err)
	}
	return conn, func() {
		_ = conn.Close()
		ts.Close()
	}
}

func newMultiTenantWebSocketHandler(t *testing.T, tokensToIDs map[string]string) (http.Handler, *session.Tenants) {
	t.Helper()

	profile := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/auth/me" {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		header := r.Header.Get("Authorization")
		for token, id := range tokensToIDs {
			if header == "Bearer "+token {
				w.Header().Set("Content-Type", "application/json")
				_, _ = w.Write([]byte(`{"code":0,"data":{"id":` + id + `}}`))
				return
			}
		}
		w.WriteHeader(http.StatusUnauthorized)
	}))
	t.Cleanup(profile.Close)
	auth.ConfigureBoxAI(profile.URL)
	t.Cleanup(func() { auth.ConfigureBoxAI("") })

	tenants := session.NewTenants()
	handler := server.NewTenantHTTPServer(&config.Config{
		Token:                    "static-secret",
		MultiTenant:              true,
		RequestTimeout:           time.Second,
		WebSocketHeartbeatPeriod: time.Second,
		WebSocketWriteTimeout:    time.Second,
	}, tenants)
	return handler, tenants
}

func firstStatusEvent(t *testing.T, conn *websocket.Conn) map[string]any {
	t.Helper()
	for attempt := 0; attempt < 64; attempt++ {
		if err := conn.SetReadDeadline(time.Now().Add(time.Second)); err != nil {
			t.Fatalf("set websocket read deadline: %v", err)
		}
		var env wsEnvelope
		if err := conn.ReadJSON(&env); err != nil {
			t.Fatalf("receive status.event: %v", err)
		}
		if env.Type != "status.event" {
			continue
		}
		payload := map[string]any{}
		if len(env.Payload) > 0 {
			if err := json.Unmarshal(env.Payload, &payload); err != nil {
				t.Fatalf("decode status.event payload: %v", err)
			}
		}
		return payload
	}
	t.Fatal("timed out waiting for status.event")
	return nil
}

func TestMultiTenantWebSocketBindsToOwnTenant(t *testing.T) {
	// Not parallel: ConfigureBoxAI mutates process-wide validator state.
	handler, tenants := newMultiTenantWebSocketHandler(t, map[string]string{
		"usera.jwt.tok": "1",
		"userb.jwt.tok": "2",
	})

	// Tenant A's desktop agent is online before the browsers connect.
	userA := tenants.ManagerFor("user:1")
	userA.RecordAuthentication("agent-a", "1.0.0", "session-a")
	userA.SetSession(session.NewAgentSession(userA.LatestAuthSnapshot()))

	connA, cleanupA := dialGatewayWebSocketPath(t, handler)
	defer cleanupA()
	authWebSocket(t, connA, "usera.jwt.tok")
	if payload := firstStatusEvent(t, connA); payload["online"] != true {
		t.Fatalf("user A should see its agent online, got %#v", payload)
	}
	// A connection is tenant-bound for its entire lifetime. Token refresh uses
	// a reconnect; an in-place second auth must never rebind existing forwarders.
	sendEnvelope(t, connA, "auth-again", "auth", map[string]any{"token": "userb.jwt.tok"})
	if env := receiveEnvelopeWithID(t, connA, "auth-again"); env.Type != "error" || env.Error != "already authenticated" {
		t.Fatalf("second auth envelope = %#v, want already authenticated", env)
	}

	connB, cleanupB := dialGatewayWebSocketPath(t, handler)
	defer cleanupB()
	authWebSocket(t, connB, "userb.jwt.tok")
	payload := firstStatusEvent(t, connB)
	if payload["online"] == true {
		t.Fatalf("user B must not see user A's agent, got %#v", payload)
	}
	if agentID, _ := payload["agent_id"].(string); agentID != "" {
		t.Fatalf("user B status leaked agent identity: %#v", payload)
	}
}

func TestMultiTenantWebSocketRejectsInvalidToken(t *testing.T) {
	handler, _ := newMultiTenantWebSocketHandler(t, map[string]string{})

	conn, cleanup := dialGatewayWebSocketPath(t, handler)
	defer cleanup()

	sendEnvelope(t, conn, "auth-1", "auth", map[string]any{"token": "invalid.jwt.tok"})
	// Pre-auth nothing drains the write queue, so the contract is simply that
	// the connection terminates without ever authorizing: either an error
	// envelope or an immediate close is acceptable.
	if err := conn.SetReadDeadline(time.Now().Add(time.Second)); err != nil {
		t.Fatalf("set websocket read deadline: %v", err)
	}
	var env wsEnvelope
	err := conn.ReadJSON(&env)
	if err == nil && !(env.Type == "error" && env.Error != "") {
		t.Fatalf("auth reply = %#v, want error envelope or closed connection", env)
	}
}

func TestMultiTenantWebSocketClosesAfterTokenRevocation(t *testing.T) {
	var revoked atomic.Bool
	profile := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		if revoked.Load() {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"code":0,"data":{"id":7}}`))
	}))
	defer profile.Close()
	auth.ConfigureBoxAI(profile.URL)
	defer auth.ConfigureBoxAI("")

	handler := server.NewTenantHTTPServer(&config.Config{
		MultiTenant:              true,
		AuthRecheckPeriod:        20 * time.Millisecond,
		RequestTimeout:           time.Second,
		WebSocketHeartbeatPeriod: time.Second,
		WebSocketWriteTimeout:    time.Second,
	}, session.NewTenants())
	conn, cleanup := dialGatewayWebSocketPath(t, handler)
	defer cleanup()
	authWebSocket(t, conn, "aaa.bbb.ccc")

	revoked.Store(true)
	if err := conn.SetReadDeadline(time.Now().Add(time.Second)); err != nil {
		t.Fatal(err)
	}
	for {
		var envelope wsEnvelope
		err := conn.ReadJSON(&envelope)
		if err != nil {
			if closeErr, ok := err.(*websocket.CloseError); ok && closeErr.Code != websocket.ClosePolicyViolation {
				t.Fatalf("close code = %d, want %d", closeErr.Code, websocket.ClosePolicyViolation)
			}
			return
		}
	}
}
