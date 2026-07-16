// BOXAI: tests for tenant isolation on the authenticated HTTP API.
package httproutes_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/liveagent/agent-gateway/internal/auth"
	"github.com/liveagent/agent-gateway/internal/config"
	"github.com/liveagent/agent-gateway/internal/server"
	"github.com/liveagent/agent-gateway/internal/session"
)

// newMultiTenantHTTPHandler wires a multi-tenant gateway against a fake boxAI
// profile endpoint that maps JWTs to account ids.
func newMultiTenantHTTPHandler(t *testing.T, tokensToIDs map[string]string) (http.Handler, *session.Tenants) {
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
				if id == "" {
					_, _ = w.Write([]byte(`{"code":0,"data":{}}`))
					return
				}
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
		Token:          "static-secret",
		MultiTenant:    true,
		RequestTimeout: 500 * time.Millisecond,
	}, tenants)
	return handler, tenants
}

func getStatus(t *testing.T, handler http.Handler, bearer string) (int, map[string]any) {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "http://gateway.test/api/status", nil)
	req.Header.Set("Authorization", "Bearer "+bearer)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	payload := map[string]any{}
	_ = json.NewDecoder(rec.Body).Decode(&payload)
	return rec.Code, payload
}

func TestMultiTenantStatusIsIsolatedPerAccount(t *testing.T) {
	// Not parallel: ConfigureBoxAI mutates process-wide validator state.
	handler, tenants := newMultiTenantHTTPHandler(t, map[string]string{
		"usera.jwt.tok": "1",
		"userb.jwt.tok": "2",
	})

	// Tenant A's desktop agent connects.
	userA := tenants.ManagerFor("user:1")
	userA.RecordAuthentication("agent-a", "1.0.0", "session-a")
	userA.SetSession(session.NewAgentSession(userA.LatestAuthSnapshot()))

	code, payload := getStatus(t, handler, "usera.jwt.tok")
	if code != http.StatusOK {
		t.Fatalf("user A status code = %d, want 200", code)
	}
	if online, _ := payload["online"].(bool); !online {
		t.Fatalf("user A should see its own agent online, got %#v", payload)
	}

	code, payload = getStatus(t, handler, "userb.jwt.tok")
	if code != http.StatusOK {
		t.Fatalf("user B status code = %d, want 200", code)
	}
	if online, _ := payload["online"].(bool); online {
		t.Fatalf("user B must not see user A's agent, got %#v", payload)
	}
	if agentID, _ := payload["agent_id"].(string); agentID != "" {
		t.Fatalf("user B status leaked agent identity: %#v", payload)
	}

	// The static shared token lands in the reserved local tenant, not user A's.
	code, payload = getStatus(t, handler, "static-secret")
	if code != http.StatusOK {
		t.Fatalf("static token status code = %d, want 200", code)
	}
	if online, _ := payload["online"].(bool); online {
		t.Fatalf("static token must not see user A's agent, got %#v", payload)
	}
}

func TestMultiTenantRejectsUnscopableIdentity(t *testing.T) {
	handler, _ := newMultiTenantHTTPHandler(t, map[string]string{
		"noid.jwt.tok": "",
	})

	code, _ := getStatus(t, handler, "noid.jwt.tok")
	if code != http.StatusForbidden {
		t.Fatalf("status code = %d, want 403 for identity without account id", code)
	}
}

func TestMultiTenantRejectsInvalidToken(t *testing.T) {
	handler, _ := newMultiTenantHTTPHandler(t, map[string]string{})

	code, _ := getStatus(t, handler, "invalid.jwt.tok")
	if code != http.StatusUnauthorized {
		t.Fatalf("status code = %d, want 401 for invalid token", code)
	}
}
