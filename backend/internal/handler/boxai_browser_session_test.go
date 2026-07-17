//go:build unit

package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/config"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type browserTestCache struct {
	mu sync.Mutex
	m  map[string]*service.RefreshTokenData
}

func (s *browserTestCache) StoreRefreshToken(_ context.Context, k string, v *service.RefreshTokenData, _ time.Duration) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	x := *v
	s.m[k] = &x
	return nil
}
func (s *browserTestCache) GetRefreshToken(_ context.Context, k string) (*service.RefreshTokenData, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	v := s.m[k]
	if v == nil {
		return nil, service.ErrRefreshTokenNotFound
	}
	x := *v
	return &x, nil
}
func (s *browserTestCache) DeleteRefreshToken(_ context.Context, k string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.m, k)
	return nil
}
func (*browserTestCache) DeleteUserRefreshTokens(context.Context, int64) error { return nil }
func (*browserTestCache) DeleteTokenFamily(context.Context, string) error      { return nil }
func (*browserTestCache) AddToUserTokenSet(context.Context, int64, string, time.Duration) error {
	return nil
}
func (*browserTestCache) AddToFamilyTokenSet(context.Context, string, string, time.Duration) error {
	return nil
}
func (*browserTestCache) GetUserTokenHashes(context.Context, int64) ([]string, error) {
	return nil, nil
}
func (*browserTestCache) GetFamilyTokenHashes(context.Context, string) ([]string, error) {
	return nil, nil
}
func (*browserTestCache) IsTokenInFamily(context.Context, string, string) (bool, error) {
	return false, nil
}

type browserTestUsers struct{ service.UserRepository }

func (*browserTestUsers) GetByID(context.Context, int64) (*service.User, error) { return nil, nil }

func browserTestHandler() *AuthHandler {
	cfg := &config.Config{}
	cfg.JWT.Secret = "browser-test-secret"
	cfg.JWT.AccessTokenExpireMinutes = 60
	cfg.JWT.RefreshTokenExpireDays = 7
	cache := &browserTestCache{m: map[string]*service.RefreshTokenData{}}
	auth := service.NewAuthService(nil, &browserTestUsers{}, nil, cache, cfg, nil, nil, nil, nil, nil, nil, nil, nil)
	return &AuthHandler{cfg: cfg, authService: auth}
}

func newBrowserContext(method, host, origin string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(method, "https://"+host+"/oauth", nil)
	c.Request.Host = host
	if origin != "" {
		c.Request.Header.Set("Origin", origin)
	}
	return c, w
}

func TestBrowserSessionCookieAttributesAndClear(t *testing.T) {
	c, w := newBrowserContext(http.MethodGet, "you-box.com", "https://you-box.com")
	setBrowserSessionCookie(c, "token", 60)
	cookie := w.Result().Cookies()[0]
	require.Equal(t, browserSessionCookie, cookie.Name)
	require.Equal(t, "/", cookie.Path)
	require.Empty(t, cookie.Domain)
	require.True(t, cookie.Secure)
	require.True(t, cookie.HttpOnly)
	require.Equal(t, http.SameSiteLaxMode, cookie.SameSite)

	c, w = newBrowserContext(http.MethodGet, "you-box.com", "https://you-box.com")
	clearBrowserSessionCookie(c)
	cookie = w.Result().Cookies()[0]
	require.Equal(t, -1, cookie.MaxAge)
	require.Empty(t, cookie.Value)
}

func TestBrowserSurfaceAndRequireBrowserRequestMatrix(t *testing.T) {
	t.Setenv("BOXAI_BROWSER_SESSION", "1")
	tests := []struct {
		name, host, origin, fetch, surface string
		csrf, ok                           bool
	}{
		{"web", "you-box.com", "https://you-box.com", "same-origin", service.BrowserSurfaceWeb, true, true},
		{"console", "console.you-box.com", "https://console.you-box.com", "none", service.BrowserSurfaceConsole, true, true},
		{"local-web", "localhost:8080", "http://localhost:5173", "", service.BrowserSurfaceWeb, true, true},
		{"local-console", "127.0.0.1:8080", "http://127.0.0.1:3000", "", service.BrowserSurfaceConsole, true, true},
		{"api", "api.you-box.com", "https://you-box.com", "same-origin", "", true, false},
		{"wrong-origin", "you-box.com", "https://evil.example", "same-origin", "", true, false},
		{"cross-site", "you-box.com", "https://you-box.com", "cross-site", "", true, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, _ := newBrowserContext(http.MethodPost, tt.host, tt.origin)
			if tt.csrf {
				c.Request.Header.Set("X-BoxAI-CSRF", "1")
			}
			c.Request.Header.Set("Sec-Fetch-Site", tt.fetch)
			got, ok := requireBrowserRequest(c)
			require.Equal(t, tt.ok, ok)
			require.Equal(t, tt.surface, got)
		})
	}
	t.Setenv("BOXAI_BROWSER_SESSION", "0")
	c, _ := newBrowserContext(http.MethodPost, "you-box.com", "https://you-box.com")
	c.Request.Header.Set("X-BoxAI-CSRF", "1")
	_, ok := requireBrowserRequest(c)
	require.False(t, ok)
}

func TestWriteOAuthTokenPairResponseBrowserAndLegacy(t *testing.T) {
	t.Setenv("BOXAI_BROWSER_SESSION", "1")
	h := browserTestHandler()
	user := &service.User{ID: 7, Email: "u@example.com", Role: "user", Status: service.StatusActive}
	pair, err := h.authService.GenerateTokenPair(context.Background(), user, "")
	require.NoError(t, err)
	c, w := newBrowserContext(http.MethodPost, "you-box.com", "https://you-box.com")
	c.Request.Header.Set(browserSessionHeader, "1")
	c.Request.Header.Set("X-BoxAI-CSRF", "1")
	h.writeOAuthTokenPairResponse(c, pair, user)
	require.NotNil(t, findCookie(w.Result().Cookies(), browserSessionCookie))
	var body map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	require.Equal(t, "session", body["auth_result"])
	require.NotEmpty(t, body["access_token"])
	require.NotNil(t, body["user"])
	require.NotContains(t, body, "refresh_token")

	pair, err = h.authService.GenerateTokenPair(context.Background(), user, "")
	require.NoError(t, err)
	c, w = newBrowserContext(http.MethodPost, "api.you-box.com", "")
	h.writeOAuthTokenPairResponse(c, pair, user)
	require.Contains(t, w.Body.String(), "refresh_token")
}

func TestRedirectOAuthBrowserSessionSanitizesCredentials(t *testing.T) {
	c, w := newBrowserContext(http.MethodGet, "you-box.com", "https://you-box.com")
	redirectOAuthBrowserSession(c, "https://you-box.com/auth/callback", "https://evil.example/?access_token=a&refresh_token=r")
	location := w.Header().Get("Location")
	require.Contains(t, location, "auth_result=session")
	require.NotContains(t, location, "access_token")
	require.NotContains(t, location, "refresh_token")
	require.NotContains(t, location, "evil.example")
	require.False(t, strings.Contains(location, "%2F%2Fevil"))
}

func TestRedirectOAuthTokenPairOrBrowserSessionUsesCookieOnUIHosts(t *testing.T) {
	t.Setenv("BOXAI_BROWSER_SESSION", "1")
	h := browserTestHandler()
	user := &service.User{ID: 7, Email: "u@example.com", Role: "user", Status: service.StatusActive}
	pair, err := h.authService.GenerateTokenPair(context.Background(), user, "")
	require.NoError(t, err)

	// BOXAI: relative frontend callback on console → host cookie.
	c, w := newBrowserContext(http.MethodGet, "console.you-box.com", "")
	h.redirectOAuthTokenPairOrBrowserSession(c, "/auth/oauth/callback", pair, user, "/dashboard")
	require.NotNil(t, findCookie(w.Result().Cookies(), browserSessionCookie))
	require.Contains(t, w.Header().Get("Location"), "auth_result=session")
	require.NotContains(t, w.Header().Get("Location"), "access_token")
	require.NotContains(t, w.Header().Get("Location"), "refresh_token")

	// BOXAI: relative frontend callback on apex → web host cookie (customer OAuth).
	pair, err = h.authService.GenerateTokenPair(context.Background(), user, "")
	require.NoError(t, err)
	c, w = newBrowserContext(http.MethodGet, "you-box.com", "")
	h.redirectOAuthTokenPairOrBrowserSession(c, "/auth/oauth/callback", pair, user, "/account")
	require.NotNil(t, findCookie(w.Result().Cookies(), browserSessionCookie))
	require.Contains(t, w.Header().Get("Location"), "auth_result=session")
	require.NotContains(t, w.Header().Get("Location"), "access_token")
	require.NotContains(t, w.Header().Get("Location"), "refresh_token")

	// Absolute console callback on non-UI host still falls back to token fragment.
	pair, err = h.authService.GenerateTokenPair(context.Background(), user, "")
	require.NoError(t, err)
	c, w = newBrowserContext(http.MethodGet, "api.you-box.com", "")
	h.redirectOAuthTokenPairOrBrowserSession(c, "https://console.you-box.com/auth/oauth/callback", pair, user, "/dashboard")
	require.Nil(t, findCookie(w.Result().Cookies(), browserSessionCookie))
	require.Contains(t, w.Header().Get("Location"), "access_token")
	require.Contains(t, w.Header().Get("Location"), "refresh_token")
}
