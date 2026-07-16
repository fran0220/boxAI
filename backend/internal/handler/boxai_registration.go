package handler

// BOXAI: opaque, short-lived email registration transactions keep plaintext
// passwords and challenge responses out of browser navigation and storage.

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"time"

	infraerrors "github.com/Wei-Shaw/sub2api/internal/pkg/errors"
	"github.com/Wei-Shaw/sub2api/internal/pkg/ip"
	"github.com/Wei-Shaw/sub2api/internal/pkg/response"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/gin-gonic/gin"
)

const (
	registrationTransactionPrefix = "boxai:registration:"
	registrationTransactionTTL    = 15 * time.Minute
)

type registrationTransaction struct {
	Email          string `json:"email"`
	PasswordHash   string `json:"password_hash"`
	PromoCode      string `json:"promo_code,omitempty"`
	InvitationCode string `json:"invitation_code,omitempty"`
	AffCode        string `json:"aff_code,omitempty"`
}

type registrationPrepareResponse struct {
	TransactionID string `json:"transaction_id"`
	Email         string `json:"email"`
	Countdown     int    `json:"countdown"`
}

type registrationCompleteRequest struct {
	TransactionID string `json:"transaction_id" binding:"required"`
	VerifyCode    string `json:"verify_code" binding:"required"`
}

func newRegistrationTransactionID() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func validRegistrationTransactionID(id string) bool {
	decoded, err := base64.RawURLEncoding.DecodeString(id)
	return err == nil && len(decoded) == 32
}

func registrationTransactionKey(id string) string { return registrationTransactionPrefix + id }

func registrationStoreError() error {
	return infraerrors.ServiceUnavailable("REGISTRATION_TRANSACTION_UNAVAILABLE", "registration transaction unavailable")
}

func (h *AuthHandler) BoxAIRegistrationPrepare(store BoxAICodeStore) gin.HandlerFunc {
	return func(c *gin.Context) {
		if store == nil {
			response.ErrorFrom(c, registrationStoreError())
			return
		}
		var req RegisterRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			response.BadRequest(c, "Invalid request: "+err.Error())
			return
		}
		ctx := c.Request.Context()
		if err := h.authService.VerifyTurnstileForRegister(ctx, req.TurnstileToken, ip.GetClientIP(c), ""); err != nil {
			response.ErrorFrom(c, err)
			return
		}
		hash, err := h.authService.HashPassword(req.Password)
		if err != nil {
			response.ErrorFrom(c, registrationStoreError())
			return
		}
		id, err := newRegistrationTransactionID()
		if err != nil {
			response.ErrorFrom(c, registrationStoreError())
			return
		}
		record, err := json.Marshal(registrationTransaction{
			Email: req.Email, PasswordHash: hash, PromoCode: req.PromoCode,
			InvitationCode: req.InvitationCode, AffCode: req.AffCode,
		})
		if err != nil || store.Put(ctx, registrationTransactionKey(id), string(record), registrationTransactionTTL) != nil {
			response.ErrorFrom(c, registrationStoreError())
			return
		}
		result, err := h.authService.SendVerifyCodeAsync(ctx, req.Email, c.GetHeader("Accept-Language"))
		if err != nil {
			_, _ = store.Take(ctx, registrationTransactionKey(id))
			response.ErrorFrom(c, err)
			return
		}
		response.Success(c, registrationPrepareResponse{TransactionID: id, Email: req.Email, Countdown: result.Countdown})
	}
}

func (h *AuthHandler) BoxAIRegistrationComplete(store BoxAICodeStore) gin.HandlerFunc {
	return func(c *gin.Context) {
		if store == nil {
			response.ErrorFrom(c, registrationStoreError())
			return
		}
		var req registrationCompleteRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			response.BadRequest(c, "Invalid request: "+err.Error())
			return
		}
		if !validRegistrationTransactionID(req.TransactionID) {
			response.BadRequest(c, "Registration transaction is invalid or expired")
			return
		}
		ctx := c.Request.Context()
		key := registrationTransactionKey(req.TransactionID)
		// BOXAI: atomically claim the transaction before registration so two
		// valid concurrent completions cannot both create side effects. Recoverable
		// verification failures restore the opaque record for another attempt.
		raw, err := store.Take(ctx, key)
		if err != nil {
			if errors.Is(err, ErrBoxAICodeNotFound) {
				response.BadRequest(c, "Registration transaction is invalid or expired")
			} else {
				response.ErrorFrom(c, registrationStoreError())
			}
			return
		}
		var record registrationTransaction
		if json.Unmarshal([]byte(raw), &record) != nil {
			response.BadRequest(c, "Registration transaction is invalid or expired")
			return
		}
		_, user, err := h.authService.RegisterWithPreparedPasswordHash(ctx, record.Email, record.PasswordHash, req.VerifyCode, record.PromoCode, record.InvitationCode, record.AffCode)
		if err != nil {
			if errors.Is(err, service.ErrInvalidVerifyCode) || errors.Is(err, service.ErrVerifyCodeMaxAttempts) || errors.Is(err, service.ErrEmailVerifyRequired) {
				if restoreErr := store.Put(ctx, key, raw, registrationTransactionTTL); restoreErr != nil {
					response.ErrorFrom(c, registrationStoreError())
					return
				}
			}
			response.ErrorFrom(c, err)
			return
		}
		h.respondWithTokenPair(c, user)
	}
}
