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

	"github.com/Wei-Shaw/sub2api/internal/pkg/response"
	"github.com/gin-gonic/gin"
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
	AuthTxNextSession            AuthTxNextAction = "session"
	AuthTxNextTOTP               AuthTxNextAction = "totp"
	AuthTxNextEmailVerify        AuthTxNextAction = "email_verify"
	AuthTxNextInvitationRequired AuthTxNextAction = "invitation_required"
	AuthTxNextLinkConfirm        AuthTxNextAction = "link_confirm"
	AuthTxNextProfileAdopt       AuthTxNextAction = "profile_adopt"
	AuthTxNextAuthenticated      AuthTxNextAction = "authenticated"
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

// authTxContinueRequest is the uniform continue payload.
type authTxContinueRequest struct {
	TransactionID string         `json:"transaction_id" binding:"required"`
	Action        string         `json:"action" binding:"required"` // e.g. "totp"
	Payload       map[string]any `json:"payload"`
}

// BoxAIAuthTxContinue advances an auth transaction.
// Currently implements action "totp" by delegating to the existing 2FA login session
// (temp_token stored on the transaction or provided in payload).
// POST /api/v1/auth/tx/continue  (gated by BOXAI_AUTH_TX=1)
func (h *AuthHandler) BoxAIAuthTxContinue(store BoxAICodeStore) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !AuthTxEnabled() {
			response.NotFound(c, "Auth transaction API is not enabled")
			return
		}
		if store == nil {
			response.ErrorFrom(c, registrationStoreError())
			return
		}
		var req authTxContinueRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			response.BadRequest(c, "Invalid request: "+err.Error())
			return
		}
		if !validAuthTxID(req.TransactionID) {
			response.BadRequest(c, "Auth transaction is invalid or expired")
			return
		}
		raw, err := store.Get(c.Request.Context(), authTxKey(req.TransactionID))
		if err != nil {
			response.BadRequest(c, "Auth transaction is invalid or expired")
			return
		}
		rec, err := unmarshalAuthTx([]byte(raw))
		if err != nil {
			response.BadRequest(c, "Auth transaction is invalid or expired")
			return
		}

		switch strings.ToLower(strings.TrimSpace(req.Action)) {
		case "totp":
			// Bridge to existing Login2FA: require temp_token + totp_code in payload.
			tempToken, _ := req.Payload["temp_token"].(string)
			if tempToken == "" {
				tempToken = rec.TempToken
			}
			code, _ := req.Payload["totp_code"].(string)
			if tempToken == "" || code == "" {
				response.BadRequest(c, "totp continue requires temp_token and totp_code")
				return
			}
			// Reuse Login2FA by binding a synthetic request body is awkward; call service path via handler clone.
			c.Set("boxai_auth_tx_id", req.TransactionID)
			// Invoke existing 2FA completion by constructing expected JSON shape through internal call.
			// Fall through to public Login2FA contract: set body fields via re-dispatch is not available;
			// call the same service steps as Login2FA.
			h.completeAuthTxTOTP(c, store, req.TransactionID, rec, tempToken, code)
			return
		default:
			response.BadRequest(c, "Unsupported auth transaction action")
		}
	}
}

func (h *AuthHandler) completeAuthTxTOTP(c *gin.Context, store BoxAICodeStore, txID string, _ *AuthTxRecord, tempToken, totpCode string) {
	if h.totpService == nil {
		response.BadRequest(c, "2FA is not available")
		return
	}
	session, err := h.totpService.GetLoginSession(c.Request.Context(), tempToken)
	if err != nil || session == nil {
		response.BadRequest(c, "Invalid or expired 2FA session")
		return
	}
	if err := h.totpService.VerifyCode(c.Request.Context(), session.UserID, totpCode); err != nil {
		response.ErrorFrom(c, err)
		return
	}
	user, err := h.userService.GetByID(c.Request.Context(), session.UserID)
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}
	if err := ensureLoginUserActive(user); err != nil {
		response.ErrorFrom(c, err)
		return
	}
	if err := h.ensureBackendModeAllowsUser(c.Request.Context(), user); err != nil {
		response.ErrorFrom(c, err)
		return
	}
	_ = h.totpService.DeleteLoginSession(c.Request.Context(), tempToken)
	_, _ = store.Take(c.Request.Context(), authTxKey(txID))
	h.authService.RecordSuccessfulLogin(c.Request.Context(), user.ID)
	h.respondWithTokenPair(c, user)
}

// BoxAIAuthTxStartFromTOTP creates a transaction wrapper around an existing temp_token 2FA step.
// Optional helper for clients that already received requires_2fa from /auth/login.
// POST /api/v1/auth/tx/from-totp  body: { temp_token, return_to? }
func (h *AuthHandler) BoxAIAuthTxStartFromTOTP(store BoxAICodeStore) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !AuthTxEnabled() {
			response.NotFound(c, "Auth transaction API is not enabled")
			return
		}
		if store == nil {
			response.ErrorFrom(c, registrationStoreError())
			return
		}
		var body struct {
			TempToken string `json:"temp_token" binding:"required"`
			ReturnTo  string `json:"return_to"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			response.BadRequest(c, "Invalid request: "+err.Error())
			return
		}
		id, err := newAuthTxID()
		if err != nil {
			response.InternalError(c, "Failed to create auth transaction")
			return
		}
		rec := &AuthTxRecord{
			Stage:     string(AuthTxNextTOTP),
			TempToken: body.TempToken,
			ReturnTo:  body.ReturnTo,
		}
		raw, err := marshalAuthTx(rec)
		if err != nil {
			response.InternalError(c, "Failed to create auth transaction")
			return
		}
		if err := store.Put(c.Request.Context(), authTxKey(id), string(raw), authTxTTL); err != nil {
			response.ErrorFrom(c, registrationStoreError())
			return
		}
		response.Success(c, AuthTxResponse{
			Status:        AuthTxNextTOTP,
			TransactionID: id,
			ReturnTo:      body.ReturnTo,
		})
	}
}
