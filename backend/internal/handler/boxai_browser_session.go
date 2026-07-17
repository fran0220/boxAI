package handler

// BOXAI: Browser-session boundary. Host and Origin are intentionally resolved
// from the direct request only; proxy forwarding headers are never consulted.

import (
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"

	"github.com/Wei-Shaw/sub2api/internal/handler/dto"
	"github.com/Wei-Shaw/sub2api/internal/pkg/response"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/gin-gonic/gin"
)

const (
	browserSessionCookie = "__Host-boxai_session"
	browserSessionHeader = "X-BoxAI-Browser-Session"
)

func envDefaultOn(name string) bool {
	switch strings.ToLower(strings.TrimSpace(os.Getenv(name))) {
	case "0", "false", "no", "off":
		return false
	default:
		return true
	}
}

// envDefaultOff is true only when the env is explicitly on. Unset / empty → off.
// BOXAI: used for one-time migration flags that must not stay on by accident.
func envDefaultOff(name string) bool {
	switch strings.ToLower(strings.TrimSpace(os.Getenv(name))) {
	case "1", "true", "yes", "on":
		return true
	default:
		return false
	}
}

func BrowserSessionEnabled() bool { return envDefaultOn("BOXAI_BROWSER_SESSION") }

// LegacyBrowserAdoptionEnabled: one-time localStorage refresh-token adopt.
// Compose / .env.example default false; process default is now off when unset
// (was envDefaultOn). Set BOXAI_LEGACY_BROWSER_ADOPTION=true only while draining.
func LegacyBrowserAdoptionEnabled() bool {
	return envDefaultOff("BOXAI_LEGACY_BROWSER_ADOPTION")
}

func browserSurface(c *gin.Context) (string, string, bool) {
	host := strings.ToLower(strings.TrimSpace(c.Request.Host))
	if h, _, err := net.SplitHostPort(host); err == nil {
		host = h
	}
	switch host {
	case "you-box.com":
		return service.BrowserSurfaceWeb, "https://you-box.com", true
	case "console.you-box.com":
		return service.BrowserSurfaceConsole, "https://console.you-box.com", true
	case "localhost", "127.0.0.1":
		origin := strings.TrimSpace(c.GetHeader("Origin"))
		switch origin {
		case "http://localhost:5173", "http://127.0.0.1:5173":
			return service.BrowserSurfaceWeb, origin, true
		case "http://localhost:3000", "http://127.0.0.1:3000":
			return service.BrowserSurfaceConsole, origin, true
		}
	}
	return "", "", false
}

func requireBrowserRequest(c *gin.Context) (string, bool) {
	if !BrowserSessionEnabled() {
		response.Forbidden(c, "Browser sessions are disabled")
		return "", false
	}
	surface, origin, ok := browserSurface(c)
	if !ok {
		response.Forbidden(c, "Browser sessions are not available for this site")
		return "", false
	}
	if c.GetHeader("X-BoxAI-CSRF") != "1" || c.GetHeader("Origin") != origin {
		response.Forbidden(c, "Request origin could not be verified")
		return "", false
	}
	fetch := strings.ToLower(strings.TrimSpace(c.GetHeader("Sec-Fetch-Site")))
	if fetch != "" && fetch != "same-origin" && fetch != "none" {
		response.Forbidden(c, "Request origin could not be verified")
		return "", false
	}
	return surface, true
}

func setBrowserSessionCookie(c *gin.Context, token string, maxAge int) {
	http.SetCookie(c.Writer, &http.Cookie{Name: browserSessionCookie, Value: token, Path: "/", MaxAge: maxAge,
		HttpOnly: true, Secure: true, SameSite: http.SameSiteLaxMode})
}

func clearBrowserSessionCookie(c *gin.Context) { setBrowserSessionCookie(c, "", -1) }

func (h *AuthHandler) respondWithBrowserSession(c *gin.Context, user *service.User, surface string) bool {
	session, ok := h.issueBrowserSession(c, user, surface)
	if !ok {
		return false
	}
	response.Success(c, AuthResponse{AccessToken: session.AccessToken, ExpiresIn: session.ExpiresIn, TokenType: "Bearer", User: dto.UserFromService(user)})
	return true
}

// issueBrowserSession is the low-level BOXAI primitive shared by response
// envelopes, OAuth JSON completions, and provider redirects.
func (h *AuthHandler) issueBrowserSession(c *gin.Context, user *service.User, surface string) (*service.BrowserSession, bool) {
	// BOXAI: console sessions are intended for admins (and temporary WeChat payment).
	// Non-admin console sessions remain allowed for payment exception paths; ops can
	// set BOXAI_CONSOLE_ADMIN_SESSION_ONLY=1 to refuse non-admin console cookies.
	if surface == service.BrowserSurfaceConsole && user != nil && !user.IsAdmin() && consoleAdminSessionOnly() {
		response.Forbidden(c, "Console browser sessions are admin-only")
		return nil, false
	}
	session, err := h.authService.GenerateBrowserSession(c.Request.Context(), user, surface)
	if err != nil {
		response.InternalError(c, "Failed to create browser session")
		return nil, false
	}
	setBrowserSessionCookie(c, session.SessionToken, session.SessionMaxAge)
	return session, true
}

// consoleAdminSessionOnly: when true, non-admin users cannot establish a console host session.
// Default off so WeChat MP purchase re-login on console still works.
func consoleAdminSessionOnly() bool {
	v := strings.TrimSpace(os.Getenv("BOXAI_CONSOLE_ADMIN_SESSION_ONLY"))
	switch strings.ToLower(v) {
	case "1", "true", "on", "yes":
		return true
	default:
		return false
	}
}

func (h *AuthHandler) writeOAuthTokenPairResponse(c *gin.Context, tokenPair *service.TokenPair, user *service.User) {
	if c.GetHeader(browserSessionHeader) == "1" {
		surface, ok := requireBrowserRequest(c)
		if !ok {
			return
		}
		// BOXAI: This pair was generated by upstream before response mode was known.
		_ = h.authService.RevokeRefreshToken(c.Request.Context(), tokenPair.RefreshToken)
		session, ok := h.issueBrowserSession(c, user, surface)
		if !ok {
			return
		}
		c.JSON(http.StatusOK, gin.H{"access_token": session.AccessToken, "expires_in": session.ExpiresIn, "token_type": "Bearer", "user": dto.UserFromService(user), "auth_result": "session"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"access_token": tokenPair.AccessToken, "refresh_token": tokenPair.RefreshToken, "expires_in": tokenPair.ExpiresIn, "token_type": "Bearer"})
}

// redirectOAuthTokenPairOrBrowserSession handles provider callbacks, which do
// not carry the Origin/CSRF headers available to frontend fetch requests.
// Production UI hosts (console or apex) may establish a host-bound session cookie.
// BOXAI: customer shell unification — apex (web surface) can mint browser sessions too.
// Relative frontend callbacks mean "same host as this callback request" (not console-only).
func (h *AuthHandler) redirectOAuthTokenPairOrBrowserSession(c *gin.Context, frontendCallback string, tokenPair *service.TokenPair, user *service.User, redirectTo string) {
	surface, _, hostOK := browserSurface(c)
	callbackURL, parseErr := url.Parse(frontendCallback)
	callbackIsRelative := parseErr == nil && callbackURL.Scheme == "" && callbackURL.Host == "" && strings.HasPrefix(callbackURL.Path, "/")
	callbackIsConsole := parseErr == nil && ((callbackURL.Scheme == "https" && callbackURL.Host == "console.you-box.com") ||
		(callbackIsRelative && surface == service.BrowserSurfaceConsole))
	callbackIsWeb := parseErr == nil && ((callbackURL.Scheme == "https" && callbackURL.Host == "you-box.com") ||
		(callbackURL.Scheme == "http" && (callbackURL.Host == "localhost:5173" || callbackURL.Host == "127.0.0.1:5173")) ||
		(callbackIsRelative && surface == service.BrowserSurfaceWeb))
	if BrowserSessionEnabled() && hostOK {
		if surface == service.BrowserSurfaceConsole && callbackIsConsole {
			_ = h.authService.RevokeRefreshToken(c.Request.Context(), tokenPair.RefreshToken)
			if _, ok := h.issueBrowserSession(c, user, surface); !ok {
				return
			}
			redirectOAuthBrowserSession(c, frontendCallback, redirectTo)
			return
		}
		if surface == service.BrowserSurfaceWeb && callbackIsWeb {
			_ = h.authService.RevokeRefreshToken(c.Request.Context(), tokenPair.RefreshToken)
			if _, ok := h.issueBrowserSession(c, user, surface); !ok {
				return
			}
			redirectOAuthBrowserSession(c, frontendCallback, redirectTo)
			return
		}
	}
	redirectOAuthTokenPair(c, frontendCallback, tokenPair, redirectTo)
}

func (h *AuthHandler) maybeRespondWithBrowserSession(c *gin.Context, user *service.User) bool {
	if c.GetHeader(browserSessionHeader) != "1" {
		return false
	}
	surface, ok := requireBrowserRequest(c)
	if !ok {
		return true
	}
	h.respondWithBrowserSession(c, user, surface)
	return true
}

func (h *AuthHandler) BrowserSession(c *gin.Context) {
	surface, ok := requireBrowserRequest(c)
	if !ok {
		return
	}
	token, err := c.Cookie(browserSessionCookie)
	if err != nil {
		response.Unauthorized(c, "Browser session is required")
		return
	}
	session, err := h.authService.ResumeBrowserSession(c.Request.Context(), token, surface)
	if err != nil {
		response.Unauthorized(c, "Browser session is invalid or expired")
		return
	}
	// Deliberately do not Set-Cookie: bootstrap is stable across concurrent tabs.
	response.Success(c, AuthResponse{AccessToken: session.AccessToken, ExpiresIn: session.ExpiresIn, TokenType: "Bearer", User: dto.UserFromService(session.User)})
}

func (h *AuthHandler) AdoptBrowserSession(c *gin.Context) {
	if !LegacyBrowserAdoptionEnabled() {
		response.Forbidden(c, "Legacy session adoption is disabled")
		return
	}
	surface, ok := requireBrowserRequest(c)
	if !ok {
		return
	}
	var req struct {
		RefreshToken string `json:"refresh_token" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request")
		return
	}
	session, err := h.authService.AdoptLegacyBrowserSession(c.Request.Context(), req.RefreshToken, surface)
	if err != nil {
		response.Unauthorized(c, "Legacy session is invalid or already adopted")
		return
	}
	setBrowserSessionCookie(c, session.SessionToken, session.SessionMaxAge)
	response.Success(c, AuthResponse{AccessToken: session.AccessToken, ExpiresIn: session.ExpiresIn, TokenType: "Bearer", User: dto.UserFromService(session.User)})
}

func (h *AuthHandler) LogoutBrowserSession(c *gin.Context) {
	_, ok := requireBrowserRequest(c)
	if !ok {
		return
	}
	if token, err := c.Cookie(browserSessionCookie); err == nil {
		_ = h.authService.RevokeRefreshToken(c.Request.Context(), token)
	}
	clearBrowserSessionCookie(c)
	response.Success(c, gin.H{"message": "Logged out successfully"})
}
