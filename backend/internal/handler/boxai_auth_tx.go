package handler

// BOXAI: Auth Transaction unifies multi-step login (password / OAuth / 2FA / link)
// behind a short-lived opaque transaction_id + next_action envelope.
// Pattern matches boxai_registration.go (Redis, atomic Take, restore on failure).
// Vue credential flows remain unchanged; React adopts this surface over time.
// Feature flag: BOXAI_AUTH_TX (default off until handlers are wired end-to-end).

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"os"
	"strings"
	"time"
)

const (
	authTxPrefix     = "boxai:authtx:"
	authTxTTL        = 10 * time.Minute
	authTxIDBytes    = 32
	authTxEnvEnabled = "BOXAI_AUTH_TX"
)

// AuthTxNextAction is the uniform next step the client should render.
type AuthTxNextAction string

const (
	AuthTxNextSession             AuthTxNextAction = "session"
	AuthTxNextTOTP                AuthTxNextAction = "totp"
	AuthTxNextEmailVerify         AuthTxNextAction = "email_verify"
	AuthTxNextInvitationRequired  AuthTxNextAction = "invitation_required"
	AuthTxNextLinkConfirm         AuthTxNextAction = "link_confirm"
	AuthTxNextProfileAdopt        AuthTxNextAction = "profile_adopt"
	AuthTxNextAuthenticated       AuthTxNextAction = "authenticated"
)

// AuthTxResponse is the uniform envelope for auth multi-step flows.
type AuthTxResponse struct {
	Status        AuthTxNextAction `json:"status"`
	TransactionID string           `json:"transaction_id,omitempty"`
	ReturnTo      string           `json:"return_to,omitempty"`
	Context       map[string]any   `json:"context,omitempty"`
}

// AuthTxRecord is the Redis payload for an in-flight auth transaction.
type AuthTxRecord struct {
	UserID    int64          `json:"user_id,omitempty"`
	Email     string         `json:"email,omitempty"`
	Provider  string         `json:"provider,omitempty"`
	ReturnTo  string         `json:"return_to,omitempty"`
	Stage     string         `json:"stage"`
	TempToken string         `json:"temp_token,omitempty"`
	Meta      map[string]any `json:"meta,omitempty"`
	CreatedAt int64          `json:"created_at"`
}

// AuthTxEnabled reports whether the unified transaction API is live.
func AuthTxEnabled() bool {
	v := strings.TrimSpace(os.Getenv(authTxEnvEnabled))
	if v == "" {
		return false
	}
	switch strings.ToLower(v) {
	case "1", "true", "on", "yes":
		return true
	default:
		return false
	}
}

func newAuthTxID() (string, error) {
	b := make([]byte, authTxIDBytes)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func validAuthTxID(id string) bool {
	if len(id) < 16 || len(id) > 128 {
		return false
	}
	for _, c := range id {
		if (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '-' || c == '_' {
			continue
		}
		return false
	}
	return true
}

func authTxKey(id string) string { return authTxPrefix + id }

func marshalAuthTx(rec *AuthTxRecord) ([]byte, error) {
	if rec.CreatedAt == 0 {
		rec.CreatedAt = time.Now().Unix()
	}
	return json.Marshal(rec)
}

func unmarshalAuthTx(raw []byte) (*AuthTxRecord, error) {
	var rec AuthTxRecord
	if err := json.Unmarshal(raw, &rec); err != nil {
		return nil, err
	}
	return &rec, nil
}
