// BOXAI: tests for the boxAI account-JWT validation fallback.
package auth_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/liveagent/agent-gateway/internal/auth"
)

func TestValidateTokenFallsBackToBoxAIJWT(t *testing.T) {
	calls := 0
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/auth/me" {
			t.Errorf("unexpected path %q", r.URL.Path)
			w.WriteHeader(http.StatusNotFound)
			return
		}
		calls++
		if r.Header.Get("Authorization") == "Bearer aaa.bbb.ccc" {
			w.WriteHeader(http.StatusOK)
			return
		}
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer ts.Close()

	auth.ConfigureBoxAI(ts.URL)
	defer auth.ConfigureBoxAI("")

	if !auth.ValidateToken("aaa.bbb.ccc", "static-token") {
		t.Fatal("valid boxAI JWT should be accepted as a fallback")
	}
	if !auth.ValidateToken("aaa.bbb.ccc", "static-token") {
		t.Fatal("cached boxAI JWT should stay accepted")
	}
	if calls != 1 {
		t.Fatalf("expected 1 upstream validation call (cached second), got %d", calls)
	}

	if auth.ValidateToken("bad.jwt.value", "static-token") {
		t.Fatal("rejected boxAI JWT should not authenticate")
	}
	if calls != 2 {
		t.Fatalf("expected 2 upstream validation calls, got %d", calls)
	}

	if auth.ValidateToken("not-a-jwt", "static-token") {
		t.Fatal("non-JWT values must not authenticate via boxAI")
	}
	if calls != 2 {
		t.Fatalf("non-JWT values must not reach the boxAI server; calls=%d", calls)
	}

	if !auth.ValidateToken("static-token", "static-token") {
		t.Fatal("static shared token must keep working")
	}
}

func TestValidateTokenRejectsJWTWhenBoxAINotConfigured(t *testing.T) {
	auth.ConfigureBoxAI("")
	if auth.ValidateToken("aaa.bbb.ccc", "static-token") {
		t.Fatal("JWT must be rejected when no boxAI server is configured")
	}
	if !auth.ValidateToken("static-token", "static-token") {
		t.Fatal("static shared token must keep working")
	}
}

func TestValidateBearerHeaderAcceptsBoxAIJWT(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer ts.Close()

	auth.ConfigureBoxAI(ts.URL)
	defer auth.ConfigureBoxAI("")

	if !auth.ValidateBearerHeader("Bearer aaa.bbb.ccc", "static-token") {
		t.Fatal("bearer header with a valid boxAI JWT should be accepted")
	}
}
