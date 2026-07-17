//go:build unit

package handler

import (
	"testing"
	"time"
)

func TestAuthTxIDHelpers(t *testing.T) {
	id, err := newAuthTxID()
	if err != nil {
		t.Fatalf("newAuthTxID: %v", err)
	}
	if !validAuthTxID(id) {
		t.Fatalf("expected valid id, got %q", id)
	}
	if validAuthTxID("short") {
		t.Fatal("short id should be invalid")
	}
	if validAuthTxID("bad id with spaces!!!!!") {
		t.Fatal("id with spaces should be invalid")
	}
	key := authTxKey(id)
	if key != authTxPrefix+id {
		t.Fatalf("authTxKey: %q", key)
	}
}

func TestAuthTxMarshalRoundTrip(t *testing.T) {
	rec := &AuthTxRecord{
		UserID: 42,
		Email:  "a@b.c",
		Stage:  "totp",
		Meta:   map[string]any{"k": "v"},
	}
	raw, err := marshalAuthTx(rec)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	if rec.CreatedAt == 0 {
		t.Fatal("CreatedAt should be set")
	}
	out, err := unmarshalAuthTx(raw)
	if err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if out.UserID != 42 || out.Email != "a@b.c" || out.Stage != "totp" {
		t.Fatalf("round-trip mismatch: %+v", out)
	}
	if out.CreatedAt == 0 {
		t.Fatal("CreatedAt lost")
	}
	// TTL constant sanity
	if authTxTTL < time.Minute {
		t.Fatal("authTxTTL too short")
	}
}

func TestAuthTxEnabledDefaultOff(t *testing.T) {
	t.Setenv(authTxEnvEnabled, "")
	if AuthTxEnabled() {
		t.Fatal("default should be off")
	}
	t.Setenv(authTxEnvEnabled, "true")
	if !AuthTxEnabled() {
		t.Fatal("true should enable")
	}
}
