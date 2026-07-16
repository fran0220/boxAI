// BOXAI: tests for tenant identity resolution (multi-tenant gateway).
package auth_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/liveagent/agent-gateway/internal/auth"
)

func newProfileServer(t *testing.T, tokensToIDs map[string]string) *httptest.Server {
	t.Helper()
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/auth/me" {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		header := r.Header.Get("Authorization")
		for token, id := range tokensToIDs {
			if header == "Bearer "+token {
				w.Header().Set("Content-Type", "application/json")
				if id == "" {
					_, _ = w.Write([]byte(`{"code":0,"message":"success","data":{}}`))
					return
				}
				_, _ = w.Write([]byte(`{"code":0,"message":"success","data":{"id":` + id + `,"username":"u"}}`))
				return
			}
		}
		w.WriteHeader(http.StatusUnauthorized)
	}))
	t.Cleanup(ts.Close)
	return ts
}

func TestResolveTokenStaticMapsToLocalTenant(t *testing.T) {
	identity, ok := auth.ResolveToken("static-token", "static-token")
	if !ok {
		t.Fatal("static token should resolve")
	}
	if identity.Method != auth.MethodStatic {
		t.Fatalf("method = %q, want %q", identity.Method, auth.MethodStatic)
	}
	if identity.TenantID() != auth.LocalTenantID {
		t.Fatalf("tenant = %q, want %q", identity.TenantID(), auth.LocalTenantID)
	}
}

func TestResolveTokenBoxAIMapsToUserTenant(t *testing.T) {
	ts := newProfileServer(t, map[string]string{"usera.jwt.tok": "42"})
	auth.ConfigureBoxAI(ts.URL)
	defer auth.ConfigureBoxAI("")

	identity, ok := auth.ResolveToken("usera.jwt.tok", "static-token")
	if !ok {
		t.Fatal("boxAI JWT should resolve")
	}
	if identity.Method != auth.MethodBoxAI || identity.UserID != "42" {
		t.Fatalf("identity = %#v, want boxai user 42", identity)
	}
	if identity.TenantID() != "user:42" {
		t.Fatalf("tenant = %q, want %q", identity.TenantID(), "user:42")
	}
}

func TestResolveTokenBoxAIWithoutIDHasNoTenant(t *testing.T) {
	ts := newProfileServer(t, map[string]string{"noid.jwt.tok": ""})
	auth.ConfigureBoxAI(ts.URL)
	defer auth.ConfigureBoxAI("")

	identity, ok := auth.ResolveToken("noid.jwt.tok", "static-token")
	if !ok {
		t.Fatal("boxAI JWT without id should still validate (single-tenant compat)")
	}
	if identity.TenantID() != "" {
		t.Fatalf("tenant = %q, want empty (unscopable identity)", identity.TenantID())
	}
}

func TestResolveTokenRejectsUnknownToken(t *testing.T) {
	auth.ConfigureBoxAI("")
	if _, ok := auth.ResolveToken("nope.jwt.tok", "static-token"); ok {
		t.Fatal("unknown token must not resolve")
	}
	if _, ok := auth.ResolveToken("", "static-token"); ok {
		t.Fatal("empty token must not resolve")
	}
}

func TestResolveBearerHeaderResolvesIdentity(t *testing.T) {
	identity, ok := auth.ResolveBearerHeader("Bearer static-token", "static-token")
	if !ok || identity.Method != auth.MethodStatic {
		t.Fatalf("identity = %#v ok=%v, want static identity", identity, ok)
	}
	if _, ok := auth.ResolveBearerHeader("static-token", "static-token"); ok {
		t.Fatal("bare token without Bearer scheme must not resolve")
	}
}
