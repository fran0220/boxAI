package handler

// BOXAI product feature — desktop OAuth (PKCE) browser login.
//
// BoxAI Desktop logs in through the system browser against the boxAI web app.
// The desktop generates a PKCE verifier/challenge + state and opens
//
//	<server>/login?boxai_desktop_auth=1&state=...&code_challenge=...&redirect_uri=boxai-desktop://auth/callback
//
// After the user authenticates in the browser, the web app calls
//
//	POST /api/v1/auth/boxai/desktop/authorize   (Bearer = web session access token)
//
// to mint a short-lived, single-use code bound to the PKCE challenge, then
// redirects the browser to redirect_uri with ?code=...&state=... . The desktop
// exchanges
//
//	POST /api/v1/auth/boxai/desktop/token   {code, code_verifier}
//
// for a fresh access/refresh token pair. PKCE prevents code interception; the
// code is one-time and short-lived (Redis GETDEL + TTL).
//
// New BOXAI file; wired in internal/server/routes/auth.go. Tracked in FORK_DELTA.md.

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"strings"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/handler/dto"
	"github.com/Wei-Shaw/sub2api/internal/pkg/response"
	middleware2 "github.com/Wei-Shaw/sub2api/internal/server/middleware"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

const (
	desktopAuthCodeTTL        = 2 * time.Minute
	desktopAuthCodeKeyPrefix  = "boxai:desktop_auth:code:"
	desktopAuthRedirectScheme = "boxai-desktop"
)

type boxaiDesktopAuthorizeRequest struct {
	CodeChallenge string `json:"code_challenge" binding:"required"`
	RedirectURI   string `json:"redirect_uri"`
}

type boxaiDesktopAuthorizeResponse struct {
	Code      string `json:"code"`
	ExpiresIn int    `json:"expires_in"`
}

type boxaiDesktopTokenRequest struct {
	Code         string `json:"code" binding:"required"`
	CodeVerifier string `json:"code_verifier" binding:"required"`
}

type desktopAuthCodeRecord struct {
	UserID        int64  `json:"user_id"`
	CodeChallenge string `json:"code_challenge"`
}

// BoxAIDesktopAuthorize mints a one-time desktop auth code for the currently
// authenticated user. Called by the boxAI web app during the desktop browser
// login handshake; requires jwtAuth upstream.
func (h *AuthHandler) BoxAIDesktopAuthorize(rdb *redis.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		subject, ok := middleware2.GetAuthSubjectFromContext(c)
		if !ok {
			response.Unauthorized(c, "User not authenticated")
			return
		}

		var req boxaiDesktopAuthorizeRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			response.BadRequest(c, "Invalid request body")
			return
		}
		challenge := strings.TrimSpace(req.CodeChallenge)
		if !isValidPKCEChallenge(challenge) {
			response.BadRequest(c, "Invalid code_challenge")
			return
		}
		if req.RedirectURI != "" && !isAllowedDesktopRedirectURI(req.RedirectURI) {
			response.BadRequest(c, "Invalid redirect_uri")
			return
		}
		if rdb == nil {
			response.InternalError(c, "Desktop auth store unavailable")
			return
		}

		code, err := newDesktopAuthCode()
		if err != nil {
			response.InternalError(c, "Failed to generate code")
			return
		}
		payload, err := json.Marshal(desktopAuthCodeRecord{
			UserID:        subject.UserID,
			CodeChallenge: challenge,
		})
		if err != nil {
			response.InternalError(c, "Failed to encode code")
			return
		}
		if err := rdb.Set(c.Request.Context(), desktopAuthCodeKeyPrefix+code, payload, desktopAuthCodeTTL).Err(); err != nil {
			response.InternalError(c, "Failed to persist code")
			return
		}

		response.Success(c, boxaiDesktopAuthorizeResponse{
			Code:      code,
			ExpiresIn: int(desktopAuthCodeTTL / time.Second),
		})
	}
}

// BoxAIDesktopToken exchanges a one-time desktop auth code + PKCE verifier for a
// fresh token pair. Public endpoint; the code is single-use and short-lived.
func (h *AuthHandler) BoxAIDesktopToken(rdb *redis.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req boxaiDesktopTokenRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			response.BadRequest(c, "Invalid request body")
			return
		}
		if rdb == nil {
			response.InternalError(c, "Desktop auth store unavailable")
			return
		}
		code := strings.TrimSpace(req.Code)
		if code == "" {
			response.BadRequest(c, "Missing code")
			return
		}

		// GETDEL keeps the code single-use even under concurrent exchange.
		payload, err := rdb.GetDel(c.Request.Context(), desktopAuthCodeKeyPrefix+code).Result()
		if err != nil || payload == "" {
			response.Unauthorized(c, "Invalid or expired code")
			return
		}
		var record desktopAuthCodeRecord
		if err := json.Unmarshal([]byte(payload), &record); err != nil {
			response.Unauthorized(c, "Invalid or expired code")
			return
		}
		if !verifyPKCE(record.CodeChallenge, strings.TrimSpace(req.CodeVerifier)) {
			response.Unauthorized(c, "PKCE verification failed")
			return
		}

		user, err := h.userService.GetByID(c.Request.Context(), record.UserID)
		if err != nil || user == nil {
			response.Unauthorized(c, "User not found")
			return
		}
		if !user.IsActive() {
			response.Unauthorized(c, "User account is not active")
			return
		}

		tokenPair, err := h.authService.GenerateTokenPair(c.Request.Context(), user, "")
		if err != nil {
			response.InternalError(c, "Failed to generate tokens")
			return
		}

		response.Success(c, AuthResponse{
			AccessToken:  tokenPair.AccessToken,
			RefreshToken: tokenPair.RefreshToken,
			ExpiresIn:    tokenPair.ExpiresIn,
			TokenType:    "Bearer",
			User:         dto.UserFromService(user),
		})
	}
}

func newDesktopAuthCode() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

// isValidPKCEChallenge validates an S256 base64url-encoded challenge (43-128
// chars per RFC 7636).
func isValidPKCEChallenge(challenge string) bool {
	if len(challenge) < 43 || len(challenge) > 128 {
		return false
	}
	_, err := base64.RawURLEncoding.DecodeString(challenge)
	return err == nil
}

func isAllowedDesktopRedirectURI(uri string) bool {
	return strings.HasPrefix(strings.ToLower(strings.TrimSpace(uri)), desktopAuthRedirectScheme+"://")
}

// verifyPKCE checks base64url(sha256(verifier)) == challenge (S256) in constant
// time.
func verifyPKCE(challenge, verifier string) bool {
	if challenge == "" || len(verifier) < 43 || len(verifier) > 128 {
		return false
	}
	sum := sha256.Sum256([]byte(verifier))
	expected := base64.RawURLEncoding.EncodeToString(sum[:])
	return subtle.ConstantTimeCompare([]byte(expected), []byte(challenge)) == 1
}
