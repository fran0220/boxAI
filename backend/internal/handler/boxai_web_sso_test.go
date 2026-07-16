//go:build unit

package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/config"
	middleware2 "github.com/Wei-Shaw/sub2api/internal/server/middleware"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/alicebob/miniredis/v2"
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/require"
)

func TestIsAllowedWebSSORedirectURIDefaults(t *testing.T) {
	t.Setenv(webSSOAllowlistEnv, "")
	t.Setenv(webSSOLocalEnv, "")
	ResetWebSSOAllowlistForTest()

	require.True(t, isAllowedWebSSORedirectURI("https://you-box.com/sso/callback"))
	require.True(t, isAllowedWebSSORedirectURI("https://console.you-box.com/boxai/sso/callback"))
	require.False(t, isAllowedWebSSORedirectURI("http://localhost:5173/sso/callback"))
	require.True(t, isAllowedWebSSORedirectURI("https://you-box.com/sso/callback/")) // trailing slash normalized
	require.False(t, isAllowedWebSSORedirectURI("https://evil.example.com/sso/callback"))
	require.False(t, isAllowedWebSSORedirectURI("http://evil.example.com/sso/callback"))
	require.False(t, isAllowedWebSSORedirectURI("boxai-desktop://auth/callback"))
	require.False(t, isAllowedWebSSORedirectURI(""))
}

func TestIsAllowedWebSSORedirectURILocalhostRequiresOptIn(t *testing.T) {
	t.Setenv(webSSOAllowlistEnv, "")
	t.Setenv(webSSOLocalEnv, "true")
	ResetWebSSOAllowlistForTest()
	require.True(t, isAllowedWebSSORedirectURI("http://localhost:5173/sso/callback"))
}

func TestIsAllowedWebSSORedirectURIExtraEnv(t *testing.T) {
	t.Setenv(webSSOAllowlistEnv, "https://staging.you-box.com/sso/callback, http://localhost:4173/sso/callback")
	ResetWebSSOAllowlistForTest()

	require.True(t, isAllowedWebSSORedirectURI("https://staging.you-box.com/sso/callback"))
	require.True(t, isAllowedWebSSORedirectURI("http://localhost:4173/sso/callback"))
	// defaults still present
	require.True(t, isAllowedWebSSORedirectURI("https://you-box.com/sso/callback"))
}

func TestWebSSOEnabledDefaultOn(t *testing.T) {
	os.Unsetenv(webSSOEnvKey)
	require.True(t, WebSSOEnabled())
	t.Setenv(webSSOEnvKey, "false")
	require.False(t, WebSSOEnabled())
	t.Setenv(webSSOEnvKey, "1")
	require.True(t, WebSSOEnabled())
}

func TestNewWebSSOAuthCodeIsUniqueAndDecodable(t *testing.T) {
	seen := make(map[string]struct{}, 50)
	for i := 0; i < 50; i++ {
		code, err := newWebSSOAuthCode()
		require.NoError(t, err)
		require.NotEmpty(t, code)
		require.GreaterOrEqual(t, len(code), 40)
		_, dup := seen[code]
		require.False(t, dup)
		seen[code] = struct{}{}
	}
}

func TestNormalizeRedirectURI(t *testing.T) {
	require.Equal(t, "https://you-box.com/sso/callback", normalizeRedirectURI("  https://you-box.com/sso/callback/  "))
	require.Equal(t, "http://localhost:5173/sso/callback", normalizeRedirectURI("http://localhost:5173/sso/callback"))
}

func TestWebSSOUsesSharedPKCE(t *testing.T) {
	verifier := strings.Repeat("c", 43)
	require.True(t, verifyPKCE(challengeFor(verifier), verifier))
	require.True(t, isValidPKCEChallenge(challengeFor(verifier)))
}

// --- handler-level SSO tests (miniredis) ---

type webSSOUserRepoStub struct {
	user *service.User
	err  error
}

func (r *webSSOUserRepoStub) GetByID(context.Context, int64) (*service.User, error) {
	return r.user, r.err
}

// redisBoxAICodeStoreForTest adapts *redis.Client to BoxAICodeStore inside tests.
type redisBoxAICodeStoreForTest struct {
	rdb *redis.Client
}

func (s *redisBoxAICodeStoreForTest) Put(ctx context.Context, key, value string, ttl time.Duration) error {
	return s.rdb.Set(ctx, key, value, ttl).Err()
}

func (s *redisBoxAICodeStoreForTest) Take(ctx context.Context, key string) (string, error) {
	val, err := s.rdb.GetDel(ctx, key).Result()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return "", ErrBoxAICodeNotFound
		}
		return "", err
	}
	if val == "" {
		return "", ErrBoxAICodeNotFound
	}
	return val, nil
}

// Minimal stubs to satisfy UserRepository via NewUserService — reuse userHandlerRepoStub if available.
// userHandlerRepoStub lives in user_handler_test.go same package.

func newWebSSOTestHandler(t *testing.T, user *service.User) (*AuthHandler, BoxAICodeStore, *redis.Client, *miniredis.Miniredis) {
	t.Helper()
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})

	repo := &userHandlerRepoStub{user: user}
	userSvc := service.NewUserService(repo, nil, nil, nil)

	refresh := &userHandlerRefreshTokenCacheStub{}
	cfg := &config.Config{
		JWT: config.JWTConfig{
			Secret:                   "test-web-sso-secret-key-32bytes!!",
			ExpireHour:               1,
			AccessTokenExpireMinutes: 60,
			RefreshTokenExpireDays:   7,
		},
	}
	authSvc := service.NewAuthService(nil, repo, nil, refresh, cfg, nil, nil, nil, nil, nil, nil, nil, nil)

	h := &AuthHandler{
		authService: authSvc,
		userService: userSvc,
	}
	return h, &redisBoxAICodeStoreForTest{rdb: rdb}, rdb, mr
}

func webSSOAuthSubject(userID int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set(string(middleware2.ContextKeyUser), middleware2.AuthSubject{UserID: userID})
		c.Next()
	}
}

func TestWebSSOAuthorizeAndTokenHappyPath(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv(webSSOEnvKey, "1")
	user := &service.User{
		ID: 7, Email: "u@example.com", Username: "u", Role: service.RoleUser,
		Status: service.StatusActive, TokenVersion: 1,
	}
	h, store, _, _ := newWebSSOTestHandler(t, user)
	verifier := strings.Repeat("a", 43)
	challenge := challengeFor(verifier)
	redirect := "https://you-box.com/sso/callback"

	// authorize
	r := gin.New()
	r.POST("/authorize", webSSOAuthSubject(7), h.BoxAIWebSSOAuthorize(store))
	body, _ := json.Marshal(map[string]string{
		"code_challenge": challenge,
		"redirect_uri":   redirect,
	})
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/authorize", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code)

	var authResp struct {
		Code int `json:"code"`
		Data struct {
			Code      string `json:"code"`
			ExpiresIn int    `json:"expires_in"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &authResp))
	require.Equal(t, 0, authResp.Code)
	require.NotEmpty(t, authResp.Data.Code)

	// token exchange
	r2 := gin.New()
	r2.POST("/token", h.BoxAIWebSSOToken(store))
	tokenBody, _ := json.Marshal(map[string]string{
		"code":          authResp.Data.Code,
		"code_verifier": verifier,
		"redirect_uri":  redirect,
	})
	w2 := httptest.NewRecorder()
	req2 := httptest.NewRequest(http.MethodPost, "/token", bytes.NewReader(tokenBody))
	req2.Header.Set("Content-Type", "application/json")
	r2.ServeHTTP(w2, req2)
	require.Equal(t, http.StatusOK, w2.Code, w2.Body.String())

	var tokenResp struct {
		Code int `json:"code"`
		Data struct {
			AccessToken string `json:"access_token"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w2.Body.Bytes(), &tokenResp))
	require.Equal(t, 0, tokenResp.Code)
	require.NotEmpty(t, tokenResp.Data.AccessToken)

	// single-use: second exchange fails
	w3 := httptest.NewRecorder()
	req3 := httptest.NewRequest(http.MethodPost, "/token", bytes.NewReader(tokenBody))
	req3.Header.Set("Content-Type", "application/json")
	r2.ServeHTTP(w3, req3)
	require.Equal(t, http.StatusUnauthorized, w3.Code)
}

func TestWebSSOTokenPKCEFail(t *testing.T) {
	gin.SetMode(gin.TestMode)
	user := &service.User{ID: 7, Status: service.StatusActive, TokenVersion: 1}
	h, store, _, _ := newWebSSOTestHandler(t, user)
	verifier := strings.Repeat("a", 43)
	challenge := challengeFor(verifier)
	redirect := "https://you-box.com/sso/callback"

	r := gin.New()
	r.POST("/authorize", webSSOAuthSubject(7), h.BoxAIWebSSOAuthorize(store))
	body, _ := json.Marshal(map[string]string{"code_challenge": challenge, "redirect_uri": redirect})
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/authorize", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	var authResp struct {
		Data struct {
			Code string `json:"code"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &authResp))

	r2 := gin.New()
	r2.POST("/token", h.BoxAIWebSSOToken(store))
	tokenBody, _ := json.Marshal(map[string]string{
		"code":          authResp.Data.Code,
		"code_verifier": strings.Repeat("b", 43),
		"redirect_uri":  redirect,
	})
	w2 := httptest.NewRecorder()
	req2 := httptest.NewRequest(http.MethodPost, "/token", bytes.NewReader(tokenBody))
	req2.Header.Set("Content-Type", "application/json")
	r2.ServeHTTP(w2, req2)
	require.Equal(t, http.StatusUnauthorized, w2.Code)
}

func TestWebSSOTokenRedirectMismatch(t *testing.T) {
	gin.SetMode(gin.TestMode)
	user := &service.User{ID: 7, Status: service.StatusActive, TokenVersion: 1}
	h, store, _, _ := newWebSSOTestHandler(t, user)
	verifier := strings.Repeat("a", 43)
	challenge := challengeFor(verifier)
	redirect := "https://you-box.com/sso/callback"

	r := gin.New()
	r.POST("/authorize", webSSOAuthSubject(7), h.BoxAIWebSSOAuthorize(store))
	body, _ := json.Marshal(map[string]string{"code_challenge": challenge, "redirect_uri": redirect})
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/authorize", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	var authResp struct {
		Data struct {
			Code string `json:"code"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &authResp))

	r2 := gin.New()
	r2.POST("/token", h.BoxAIWebSSOToken(store))
	// Use another allowlisted URI that was not bound to the code
	tokenBody, _ := json.Marshal(map[string]string{
		"code":          authResp.Data.Code,
		"code_verifier": verifier,
		"redirect_uri":  "https://console.you-box.com/boxai/sso/callback",
	})
	w2 := httptest.NewRecorder()
	req2 := httptest.NewRequest(http.MethodPost, "/token", bytes.NewReader(tokenBody))
	req2.Header.Set("Content-Type", "application/json")
	r2.ServeHTTP(w2, req2)
	require.Equal(t, http.StatusUnauthorized, w2.Code)
}

func TestWebSSOTokenRequiresRedirectURI(t *testing.T) {
	gin.SetMode(gin.TestMode)
	user := &service.User{ID: 7, Status: service.StatusActive}
	h, store, _, _ := newWebSSOTestHandler(t, user)
	r := gin.New()
	r.POST("/token", h.BoxAIWebSSOToken(store))
	tokenBody, _ := json.Marshal(map[string]string{
		"code":          "abc",
		"code_verifier": strings.Repeat("a", 43),
	})
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/token", bytes.NewReader(tokenBody))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	require.Equal(t, http.StatusBadRequest, w.Code)
}

func TestWebSSOTokenInactiveUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	user := &service.User{ID: 7, Status: "disabled", TokenVersion: 1}
	h, store, _, _ := newWebSSOTestHandler(t, user)
	verifier := strings.Repeat("a", 43)
	challenge := challengeFor(verifier)
	redirect := "https://you-box.com/sso/callback"

	// Persist code directly (authorize would also work with subject 7)
	payload, _ := json.Marshal(webSSOCodeRecord{UserID: 7, CodeChallenge: challenge, RedirectURI: redirect})
	require.NoError(t, store.Put(context.Background(), webSSOCodeKeyPrefix+"testcode", string(payload), time.Minute))

	r := gin.New()
	r.POST("/token", h.BoxAIWebSSOToken(store))
	tokenBody, _ := json.Marshal(map[string]string{
		"code":          "testcode",
		"code_verifier": verifier,
		"redirect_uri":  redirect,
	})
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/token", bytes.NewReader(tokenBody))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	require.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestWebSSOTokenRedisTransportError(t *testing.T) {
	gin.SetMode(gin.TestMode)
	user := &service.User{ID: 7, Status: service.StatusActive}
	h, store, _, mr := newWebSSOTestHandler(t, user)
	mr.Close() // force connection errors

	r := gin.New()
	r.POST("/token", h.BoxAIWebSSOToken(store))
	tokenBody, _ := json.Marshal(map[string]string{
		"code":          "missing",
		"code_verifier": strings.Repeat("a", 43),
		"redirect_uri":  "https://you-box.com/sso/callback",
	})
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/token", bytes.NewReader(tokenBody))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	require.Equal(t, http.StatusInternalServerError, w.Code)
}
