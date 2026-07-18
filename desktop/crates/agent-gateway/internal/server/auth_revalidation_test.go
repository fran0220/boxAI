package server

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"sync/atomic"
	"testing"

	"github.com/liveagent/agent-gateway/internal/auth"
	"github.com/liveagent/agent-gateway/internal/config"
)

func TestHostedCredentialRevalidatorToleratesBoundedAuthorityOutage(t *testing.T) {
	var responseStatus atomic.Int64
	responseStatus.Store(http.StatusOK)
	profile := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		status := int(responseStatus.Load())
		if status != http.StatusOK {
			w.WriteHeader(status)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"code":0,"data":{"id":12}}`))
	}))
	defer profile.Close()
	auth.ConfigureBoxAI(profile.URL)
	defer auth.ConfigureBoxAI("")

	identity, ok := auth.ResolveTokenWithPolicy("aaa.bbb.ccc", "", false)
	if !ok {
		t.Fatal("initial credential did not resolve")
	}
	revalidator := newHostedCredentialRevalidator(&config.Config{MultiTenant: true}, "aaa.bbb.ccc", identity)

	responseStatus.Store(http.StatusServiceUnavailable)
	for attempt := 1; attempt < authRevalidationUnknownLimit; attempt++ {
		if revalidator.shouldTerminate() {
			t.Fatalf("transient authority failure terminated on attempt %d", attempt)
		}
	}
	responseStatus.Store(http.StatusOK)
	if revalidator.shouldTerminate() {
		t.Fatal("successful revalidation did not reset the failure budget")
	}
	responseStatus.Store(http.StatusServiceUnavailable)
	for attempt := 1; attempt < authRevalidationUnknownLimit; attempt++ {
		if revalidator.shouldTerminate() {
			t.Fatalf("reset failure budget terminated on attempt %d", attempt)
		}
	}
	if !revalidator.shouldTerminate() {
		t.Fatal("bounded authority outage did not eventually fail closed")
	}
}

func TestHostedCredentialRevalidatorRejectsIdentityChange(t *testing.T) {
	var userID atomic.Int64
	userID.Store(1)
	profile := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"code":0,"data":{"id":` + strconv.FormatInt(userID.Load(), 10) + `}}`))
	}))
	defer profile.Close()
	auth.ConfigureBoxAI(profile.URL)
	defer auth.ConfigureBoxAI("")

	identity, ok := auth.ResolveTokenWithPolicy("aaa.bbb.ccc", "", false)
	if !ok {
		t.Fatal("initial credential did not resolve")
	}
	revalidator := newHostedCredentialRevalidator(&config.Config{MultiTenant: true}, "aaa.bbb.ccc", identity)
	userID.Store(2)
	if !revalidator.shouldTerminate() {
		t.Fatal("identity-changing token revalidation did not terminate")
	}
}
