package handler

// BOXAI product feature — desktop JWT-as-credential gateway auth.
//
// BoxAI Desktop authenticates with a boxAI account and sends its short-lived
// access token (JWT) as the Bearer credential to the model gateway (/v1/*).
// Upstream gateway auth only accepts API keys, so this additive, flag-gated
// middleware translates a valid JWT into the caller's own gateway API key by
// rewriting the Authorization header, then defers to the standard API-key auth
// chain, which stays authoritative for validation, billing, subscription and
// group checks. It is a strict no-op when disabled or when the presented
// credential is not a boxAI JWT, so genuine API-key callers are unaffected.
//
// Enabled via env BOXAI_DESKTOP_JWT_GATEWAY (1/true/yes/on). Wired in
// internal/server/routes/gateway.go. Tracked in FORK_DELTA.md.

import (
	"context"
	"errors"
	"os"
	"strings"

	"github.com/Wei-Shaw/sub2api/internal/pkg/pagination"
	middleware2 "github.com/Wei-Shaw/sub2api/internal/server/middleware"
	"github.com/Wei-Shaw/sub2api/internal/service"

	"github.com/gin-gonic/gin"
)

// desktopJWTGatewayEnvKey toggles the additive desktop JWT gateway auth path.
// It defaults ON (the middleware is a strict no-op for non-JWT credentials, so
// existing API-key callers are unaffected); set it to a falsey value to opt out.
const desktopJWTGatewayEnvKey = "BOXAI_DESKTOP_JWT_GATEWAY"

// Narrow dependency surfaces so the middleware is unit-testable; the concrete
// *service.AuthService, *service.UserService and *service.APIKeyService satisfy
// them, so the gateway wiring needs no extra dependency injection.
type (
	desktopTokenValidator interface {
		ValidateToken(token string) (*service.JWTClaims, error)
	}
	desktopUserReader interface {
		GetByID(ctx context.Context, id int64) (*service.User, error)
	}
	desktopKeyLister interface {
		List(ctx context.Context, userID int64, params pagination.PaginationParams, filters service.APIKeyListFilters) ([]service.APIKey, *pagination.PaginationResult, error)
	}
)

// DesktopJWTGatewayEnabled reports whether the additive desktop JWT gateway
// auth path is enabled. It defaults to true and is disabled only when the
// operator explicitly sets a falsey value.
func DesktopJWTGatewayEnabled() bool {
	switch strings.ToLower(strings.TrimSpace(os.Getenv(desktopJWTGatewayEnvKey))) {
	case "0", "false", "no", "off":
		return false
	default:
		return true
	}
}

// DesktopJWTGatewayAuth builds the JWT→API-key translation middleware. The auth
// and user services come from the AuthHandler receiver, so only apiKeyService
// needs to be supplied at the gateway wiring point (no extra DI).
func (h *AuthHandler) DesktopJWTGatewayAuth(apiKeyService *service.APIKeyService) gin.HandlerFunc {
	return desktopJWTGatewayAuth(DesktopJWTGatewayEnabled(), h.authService, h.userService, apiKeyService)
}

func desktopJWTGatewayAuth(enabled bool, auth desktopTokenValidator, users desktopUserReader, keys desktopKeyLister) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !enabled {
			c.Next()
			return
		}

		token := desktopCredentialToken(c)
		// Only header.payload.signature shapes are JWT candidates; anything else
		// is treated as a real API key and left to the downstream API-key auth.
		if token == "" || strings.Count(token, ".") != 2 {
			c.Next()
			return
		}

		claims, err := auth.ValidateToken(token)
		if err != nil || claims == nil {
			// Not a valid boxAI JWT: fall through so a genuine API key that
			// happens to contain two dots can still authenticate downstream.
			c.Next()
			return
		}

		user, err := users.GetByID(c.Request.Context(), claims.UserID)
		if err != nil || user == nil {
			middleware2.AbortWithError(c, 401, "USER_NOT_FOUND", "User associated with token not found")
			return
		}
		if !user.IsActive() {
			middleware2.AbortWithError(c, 401, "USER_INACTIVE", "User account is not active")
			return
		}
		// Reject tokens issued before a password change (revocation).
		if claims.TokenVersion != user.TokenVersion {
			middleware2.AbortWithError(c, 401, "TOKEN_REVOKED", "Token has been revoked")
			return
		}

		apiKeyString, err := resolveUserGatewayKey(c.Request.Context(), keys, claims.UserID)
		if err != nil {
			middleware2.AbortWithError(c, 403, "NO_GATEWAY_KEY", err.Error())
			return
		}

		// Hand off to the standard API-key auth chain by presenting the user's
		// own key as the single source of truth.
		c.Request.Header.Set("Authorization", "Bearer "+apiKeyString)
		c.Request.Header.Del("x-api-key")
		c.Request.Header.Del("x-goog-api-key")
		c.Next()
	}
}

// desktopCredentialToken extracts the presented credential across the header
// variants pi-ai uses: Authorization (OpenAI transport) and x-api-key /
// x-goog-api-key (Anthropic / Gemini transports).
func desktopCredentialToken(c *gin.Context) string {
	if token := bearerToken(c.GetHeader("Authorization")); token != "" {
		return token
	}
	if token := strings.TrimSpace(c.GetHeader("x-api-key")); token != "" {
		return token
	}
	return strings.TrimSpace(c.GetHeader("x-goog-api-key"))
}

func bearerToken(header string) string {
	header = strings.TrimSpace(header)
	if header == "" {
		return ""
	}
	parts := strings.SplitN(header, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		return ""
	}
	return strings.TrimSpace(parts[1])
}

// resolveUserGatewayKey picks the plaintext gateway key the desktop should use:
// the caller's first active API key bound to a group (required for gateway
// routing), falling back to any active key.
func resolveUserGatewayKey(ctx context.Context, keyLister desktopKeyLister, userID int64) (string, error) {
	keys, _, err := keyLister.List(
		ctx,
		userID,
		pagination.PaginationParams{Page: 1, PageSize: 100},
		service.APIKeyListFilters{},
	)
	if err != nil {
		return "", errors.New("failed to load account API keys")
	}

	var fallback string
	for i := range keys {
		key := keys[i]
		if !key.IsActive() || key.Key == "" {
			continue
		}
		if key.GroupID != nil {
			return key.Key, nil
		}
		if fallback == "" {
			fallback = key.Key
		}
	}
	if fallback != "" {
		return fallback, nil
	}
	return "", errors.New("no active API key found for account; create one in BoxAI first")
}
