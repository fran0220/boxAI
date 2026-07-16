package handler

// BOXAI product feature — PKCE one-time-code Web SSO between origins.
//
// Marketing / Creator (you-box.com) and the Vue console (console.you-box.com)
// each keep their own localStorage JWT. To link sessions without cookie-domain
// SSO, an authenticated origin mints a short-lived code:
//
//	POST /api/v1/auth/boxai/sso/authorize   (Bearer = current origin JWT)
//	  { code_challenge, redirect_uri }
//
// then redirects the browser to redirect_uri with the code in the URL fragment
// (#code=...&state=...). The receiving origin exchanges:
//
//	POST /api/v1/auth/boxai/sso/token   { code, code_verifier, redirect_uri }
//
// for a fresh access/refresh token pair. redirect_uri is required on both
// authorize and token and must match the allowlisted value bound to the code.
// Flag BOXAI_WEB_SSO (default on). Allowlist changes require process restart.
//
// Mirrors desktop PKCE in boxai_desktop_auth.go. Tracked in FORK_DELTA.md.

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/handler/dto"
	"github.com/Wei-Shaw/sub2api/internal/pkg/response"
	middleware2 "github.com/Wei-Shaw/sub2api/internal/server/middleware"

	"github.com/gin-gonic/gin"
)

const (
	webSSOCodeTTL       = 2 * time.Minute
	webSSOCodeKeyPrefix = "boxai:web_sso:code:"
	webSSOEnvKey        = "BOXAI_WEB_SSO"
	webSSOAllowlistEnv  = "BOXAI_WEB_SSO_REDIRECT_URIS"
	webSSOLocalEnv      = "BOXAI_WEB_SSO_ALLOW_LOCALHOST"
)

// BOXAI: Secure production defaults. Local callbacks require explicit opt-in.
var defaultWebSSORedirectURIs = []string{
	"https://you-box.com/sso/callback",
	"https://console.you-box.com/boxai/sso/callback",
}
var localWebSSORedirectURIs = []string{
	"http://localhost:5173/sso/callback",
	"http://127.0.0.1:5173/sso/callback",
	"http://localhost:3000/boxai/sso/callback",
	"http://127.0.0.1:3000/boxai/sso/callback",
}

var (
	webSSOAllowlistOnce sync.Once
	webSSOAllowlistSet  map[string]struct{}
)

type boxaiWebSSOAuthorizeRequest struct {
	CodeChallenge string `json:"code_challenge" binding:"required"`
	RedirectURI   string `json:"redirect_uri" binding:"required"`
}

type boxaiWebSSOAuthorizeResponse struct {
	Code      string `json:"code"`
	ExpiresIn int    `json:"expires_in"`
}

type boxaiWebSSOTokenRequest struct {
	Code         string `json:"code" binding:"required"`
	CodeVerifier string `json:"code_verifier" binding:"required"`
	RedirectURI  string `json:"redirect_uri" binding:"required"`
}

type webSSOCodeRecord struct {
	UserID        int64  `json:"user_id"`
	CodeChallenge string `json:"code_challenge"`
	RedirectURI   string `json:"redirect_uri"`
}

// WebSSOEnabled reports whether web SSO endpoints are enabled (default on).
func WebSSOEnabled() bool {
	switch strings.ToLower(strings.TrimSpace(os.Getenv(webSSOEnvKey))) {
	case "0", "false", "no", "off":
		return false
	default:
		return true
	}
}

func loadWebSSOAllowlist() map[string]struct{} {
	webSSOAllowlistOnce.Do(func() {
		webSSOAllowlistSet = make(map[string]struct{})
		add := func(uri string) {
			uri = normalizeRedirectURI(uri)
			if uri != "" {
				webSSOAllowlistSet[uri] = struct{}{}
			}
		}
		for _, uri := range defaultWebSSORedirectURIs {
			add(uri)
		}
		if strings.EqualFold(strings.TrimSpace(os.Getenv(webSSOLocalEnv)), "true") || strings.TrimSpace(os.Getenv(webSSOLocalEnv)) == "1" {
			for _, uri := range localWebSSORedirectURIs {
				add(uri)
			}
		}
		if extra := strings.TrimSpace(os.Getenv(webSSOAllowlistEnv)); extra != "" {
			for _, part := range strings.Split(extra, ",") {
				add(part)
			}
		}
	})
	return webSSOAllowlistSet
}

// ResetWebSSOAllowlistForTest clears the cached allowlist (unit tests only).
func ResetWebSSOAllowlistForTest() {
	webSSOAllowlistOnce = sync.Once{}
	webSSOAllowlistSet = nil
}

func normalizeRedirectURI(uri string) string {
	return strings.TrimRight(strings.TrimSpace(uri), "/")
}

// isAllowedWebSSORedirectURI reports whether uri is on the static allowlist.
func isAllowedWebSSORedirectURI(uri string) bool {
	uri = normalizeRedirectURI(uri)
	if uri == "" {
		return false
	}
	// Only https (prod) or http localhost/127.0.0.1 (dev).
	lower := strings.ToLower(uri)
	if !strings.HasPrefix(lower, "https://") &&
		!strings.HasPrefix(lower, "http://localhost") &&
		!strings.HasPrefix(lower, "http://127.0.0.1") {
		return false
	}
	_, ok := loadWebSSOAllowlist()[uri]
	return ok
}

// BoxAIWebSSOAuthorize mints a one-time SSO code for the authenticated user.
func (h *AuthHandler) BoxAIWebSSOAuthorize(store BoxAICodeStore) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !WebSSOEnabled() {
			response.Error(c, 403, "Web SSO is disabled")
			return
		}
		subject, ok := middleware2.GetAuthSubjectFromContext(c)
		if !ok {
			response.Unauthorized(c, "User not authenticated")
			return
		}

		var req boxaiWebSSOAuthorizeRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			response.BadRequest(c, "Invalid request body")
			return
		}
		challenge := strings.TrimSpace(req.CodeChallenge)
		if !isValidPKCEChallenge(challenge) {
			response.BadRequest(c, "Invalid code_challenge")
			return
		}
		redirectURI := normalizeRedirectURI(req.RedirectURI)
		if !isAllowedWebSSORedirectURI(redirectURI) {
			response.BadRequest(c, "Invalid redirect_uri")
			return
		}
		if store == nil {
			response.InternalError(c, "SSO store unavailable")
			return
		}

		code, err := newWebSSOAuthCode()
		if err != nil {
			response.InternalError(c, "Failed to generate code")
			return
		}
		payload, err := json.Marshal(webSSOCodeRecord{
			UserID:        subject.UserID,
			CodeChallenge: challenge,
			RedirectURI:   redirectURI,
		})
		if err != nil {
			response.InternalError(c, "Failed to encode code")
			return
		}
		if err := store.Put(c.Request.Context(), webSSOCodeKeyPrefix+code, string(payload), webSSOCodeTTL); err != nil {
			response.InternalError(c, "Failed to persist code")
			return
		}

		response.Success(c, boxaiWebSSOAuthorizeResponse{
			Code:      code,
			ExpiresIn: int(webSSOCodeTTL / time.Second),
		})
	}
}

// BoxAIWebSSOToken exchanges a one-time SSO code + PKCE verifier for tokens.
func (h *AuthHandler) BoxAIWebSSOToken(store BoxAICodeStore) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !WebSSOEnabled() {
			response.Error(c, 403, "Web SSO is disabled")
			return
		}
		var req boxaiWebSSOTokenRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			response.BadRequest(c, "Invalid request body")
			return
		}
		if store == nil {
			response.InternalError(c, "SSO store unavailable")
			return
		}
		code := strings.TrimSpace(req.Code)
		if code == "" {
			response.BadRequest(c, "Missing code")
			return
		}

		key := webSSOCodeKeyPrefix + code
		// BOXAI: Verify bindings before atomic consumption where the backing
		// store supports a non-consuming read (the production Redis store does).
		payload := ""
		var err error
		if verifying, ok := store.(BoxAICodeVerifyingStore); ok {
			payload, err = verifying.Get(c.Request.Context(), key)
		} else {
			payload, err = store.Take(c.Request.Context(), key)
		}
		if err != nil {
			if errors.Is(err, ErrBoxAICodeNotFound) {
				response.Unauthorized(c, "Invalid or expired code")
				return
			}
			response.InternalError(c, "SSO store unavailable")
			return
		}
		if payload == "" {
			response.Unauthorized(c, "Invalid or expired code")
			return
		}
		var record webSSOCodeRecord
		if err := json.Unmarshal([]byte(payload), &record); err != nil {
			response.Unauthorized(c, "Invalid or expired code")
			return
		}
		if !verifyPKCE(record.CodeChallenge, strings.TrimSpace(req.CodeVerifier)) {
			response.Unauthorized(c, "Invalid or expired sign-in code")
			return
		}
		if normalizeRedirectURI(req.RedirectURI) != record.RedirectURI {
			response.Unauthorized(c, "Invalid or expired sign-in code")
			return
		}
		if _, ok := store.(BoxAICodeVerifyingStore); ok {
			consumed, takeErr := store.Take(c.Request.Context(), key)
			if takeErr != nil || consumed != payload {
				response.Unauthorized(c, "Invalid or expired code")
				return
			}
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

		// BOXAI: Cookie mode uses the same centralized issuance helper as login.
		if h.maybeRespondWithBrowserSession(c, user) {
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

func newWebSSOAuthCode() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}
