//go:build unit

package handler

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Wei-Shaw/sub2api/internal/pkg/pagination"
	"github.com/Wei-Shaw/sub2api/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type fakeDesktopTokenValidator struct {
	claims   *service.JWTClaims
	err      error
	gotToken string
}

func (f *fakeDesktopTokenValidator) ValidateToken(token string) (*service.JWTClaims, error) {
	f.gotToken = token
	return f.claims, f.err
}

type fakeDesktopUserReader struct {
	user *service.User
	err  error
}

func (f *fakeDesktopUserReader) GetByID(_ context.Context, _ int64) (*service.User, error) {
	return f.user, f.err
}

type fakeDesktopKeyLister struct {
	keys []service.APIKey
	err  error
}

func (f *fakeDesktopKeyLister) List(_ context.Context, _ int64, _ pagination.PaginationParams, _ service.APIKeyListFilters) ([]service.APIKey, *pagination.PaginationResult, error) {
	return f.keys, nil, f.err
}

type desktopMWResult struct {
	status     int
	reached    bool
	authHeader string
	xAPIKey    string
	xGoog      string
}

func runDesktopGatewayMW(t *testing.T, mw gin.HandlerFunc, req *http.Request) desktopMWResult {
	t.Helper()
	gin.SetMode(gin.TestMode)

	res := desktopMWResult{}
	r := gin.New()
	r.POST("/v1/messages", mw, func(c *gin.Context) {
		res.reached = true
		res.authHeader = c.GetHeader("Authorization")
		res.xAPIKey = c.GetHeader("x-api-key")
		res.xGoog = c.GetHeader("x-goog-api-key")
		c.String(http.StatusOK, "ok")
	})

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	res.status = w.Code
	return res
}

func groupedKey(key string, groupID int64) service.APIKey {
	return service.APIKey{Key: key, Status: service.StatusActive, GroupID: &groupID}
}

func TestDesktopJWTGatewayAuthDisabledIsNoOp(t *testing.T) {
	mw := desktopJWTGatewayAuth(false,
		&fakeDesktopTokenValidator{claims: &service.JWTClaims{UserID: 1}},
		&fakeDesktopUserReader{user: &service.User{ID: 1, Status: service.StatusActive}},
		&fakeDesktopKeyLister{keys: []service.APIKey{groupedKey("sk-should-not-be-used", 7)}},
	)

	req := httptest.NewRequest(http.MethodPost, "/v1/messages", nil)
	req.Header.Set("Authorization", "Bearer header.payload.signature")

	res := runDesktopGatewayMW(t, mw, req)

	require.True(t, res.reached)
	require.Equal(t, http.StatusOK, res.status)
	require.Equal(t, "Bearer header.payload.signature", res.authHeader, "disabled path must not rewrite the credential")
}

func TestDesktopJWTGatewayAuthNonJWTFallsThrough(t *testing.T) {
	validator := &fakeDesktopTokenValidator{claims: &service.JWTClaims{UserID: 1}}
	mw := desktopJWTGatewayAuth(true, validator,
		&fakeDesktopUserReader{user: &service.User{ID: 1, Status: service.StatusActive}},
		&fakeDesktopKeyLister{keys: []service.APIKey{groupedKey("sk-should-not-be-used", 7)}},
	)

	req := httptest.NewRequest(http.MethodPost, "/v1/messages", nil)
	req.Header.Set("Authorization", "Bearer sk-plain-api-key")

	res := runDesktopGatewayMW(t, mw, req)

	require.True(t, res.reached)
	require.Equal(t, "Bearer sk-plain-api-key", res.authHeader, "real API keys must pass through untouched")
	require.Empty(t, validator.gotToken, "non-JWT credential must not be validated as a token")
}

func TestDesktopJWTGatewayAuthInvalidJWTFallsThrough(t *testing.T) {
	// A two-dot credential that fails token validation could still be a genuine
	// API key, so the middleware must defer to the downstream API-key auth.
	mw := desktopJWTGatewayAuth(true,
		&fakeDesktopTokenValidator{err: errors.New("invalid token")},
		&fakeDesktopUserReader{user: &service.User{ID: 1, Status: service.StatusActive}},
		&fakeDesktopKeyLister{keys: []service.APIKey{groupedKey("sk-should-not-be-used", 7)}},
	)

	req := httptest.NewRequest(http.MethodPost, "/v1/messages", nil)
	req.Header.Set("Authorization", "Bearer a.b.c")

	res := runDesktopGatewayMW(t, mw, req)

	require.True(t, res.reached)
	require.Equal(t, "Bearer a.b.c", res.authHeader)
}

func TestDesktopJWTGatewayAuthValidJWTRewritesAuthorization(t *testing.T) {
	mw := desktopJWTGatewayAuth(true,
		&fakeDesktopTokenValidator{claims: &service.JWTClaims{UserID: 42, TokenVersion: 3}},
		&fakeDesktopUserReader{user: &service.User{ID: 42, Status: service.StatusActive, TokenVersion: 3}},
		&fakeDesktopKeyLister{keys: []service.APIKey{groupedKey("sk-live-key", 9)}},
	)

	req := httptest.NewRequest(http.MethodPost, "/v1/messages", nil)
	req.Header.Set("Authorization", "Bearer header.payload.signature")
	req.Header.Set("x-api-key", "header.payload.signature")
	req.Header.Set("x-goog-api-key", "header.payload.signature")

	res := runDesktopGatewayMW(t, mw, req)

	require.True(t, res.reached)
	require.Equal(t, "Bearer sk-live-key", res.authHeader)
	require.Empty(t, res.xAPIKey, "x-api-key must be cleared after rewrite")
	require.Empty(t, res.xGoog, "x-goog-api-key must be cleared after rewrite")
}

func TestDesktopJWTGatewayAuthValidJWTViaXAPIKeyHeader(t *testing.T) {
	mw := desktopJWTGatewayAuth(true,
		&fakeDesktopTokenValidator{claims: &service.JWTClaims{UserID: 42, TokenVersion: 0}},
		&fakeDesktopUserReader{user: &service.User{ID: 42, Status: service.StatusActive, TokenVersion: 0}},
		&fakeDesktopKeyLister{keys: []service.APIKey{groupedKey("sk-live-key", 9)}},
	)

	req := httptest.NewRequest(http.MethodPost, "/v1/messages", nil)
	req.Header.Set("x-api-key", "header.payload.signature")

	res := runDesktopGatewayMW(t, mw, req)

	require.True(t, res.reached)
	require.Equal(t, "Bearer sk-live-key", res.authHeader)
	require.Empty(t, res.xAPIKey)
}

func TestDesktopJWTGatewayAuthRejectsInactiveUser(t *testing.T) {
	mw := desktopJWTGatewayAuth(true,
		&fakeDesktopTokenValidator{claims: &service.JWTClaims{UserID: 42}},
		&fakeDesktopUserReader{user: &service.User{ID: 42, Status: "disabled"}},
		&fakeDesktopKeyLister{keys: []service.APIKey{groupedKey("sk-live-key", 9)}},
	)

	req := httptest.NewRequest(http.MethodPost, "/v1/messages", nil)
	req.Header.Set("Authorization", "Bearer header.payload.signature")

	res := runDesktopGatewayMW(t, mw, req)

	require.False(t, res.reached)
	require.Equal(t, http.StatusUnauthorized, res.status)
}

func TestDesktopJWTGatewayAuthRejectsRevokedTokenVersion(t *testing.T) {
	mw := desktopJWTGatewayAuth(true,
		&fakeDesktopTokenValidator{claims: &service.JWTClaims{UserID: 42, TokenVersion: 1}},
		&fakeDesktopUserReader{user: &service.User{ID: 42, Status: service.StatusActive, TokenVersion: 5}},
		&fakeDesktopKeyLister{keys: []service.APIKey{groupedKey("sk-live-key", 9)}},
	)

	req := httptest.NewRequest(http.MethodPost, "/v1/messages", nil)
	req.Header.Set("Authorization", "Bearer header.payload.signature")

	res := runDesktopGatewayMW(t, mw, req)

	require.False(t, res.reached)
	require.Equal(t, http.StatusUnauthorized, res.status)
}

func TestDesktopJWTGatewayAuthRejectsWhenNoActiveKey(t *testing.T) {
	mw := desktopJWTGatewayAuth(true,
		&fakeDesktopTokenValidator{claims: &service.JWTClaims{UserID: 42}},
		&fakeDesktopUserReader{user: &service.User{ID: 42, Status: service.StatusActive}},
		&fakeDesktopKeyLister{keys: []service.APIKey{{Key: "sk-dead", Status: "disabled"}}},
	)

	req := httptest.NewRequest(http.MethodPost, "/v1/messages", nil)
	req.Header.Set("Authorization", "Bearer header.payload.signature")

	res := runDesktopGatewayMW(t, mw, req)

	require.False(t, res.reached)
	require.Equal(t, http.StatusForbidden, res.status)
}

func TestResolveUserGatewayKeyPrefersGroupedActiveKey(t *testing.T) {
	lister := &fakeDesktopKeyLister{keys: []service.APIKey{
		{Key: "sk-nogroup", Status: service.StatusActive},
		groupedKey("sk-grouped", 4),
	}}

	got, err := resolveUserGatewayKey(context.Background(), lister, 1)
	require.NoError(t, err)
	require.Equal(t, "sk-grouped", got)
}

func TestResolveUserGatewayKeyPrefersGroupedCreatorKey(t *testing.T) {
	creator := groupedKey("sk-creator", 9)
	creator.Name = CreatorAPIKeyName
	lister := &fakeDesktopKeyLister{keys: []service.APIKey{
		groupedKey("sk-grouped", 4),
		creator,
		{Key: "sk-nogroup", Status: service.StatusActive},
	}}

	got, err := resolveUserGatewayKey(context.Background(), lister, 1)
	require.NoError(t, err)
	require.Equal(t, "sk-creator", got)
}

func TestResolveUserGatewayKeyDoesNotPreferUngroupedCreatorOverGrouped(t *testing.T) {
	// After Creator ensure without available groups, an ungrouped boxai-creator
	// must not steal Desktop JWT bridge away from a working grouped key.
	lister := &fakeDesktopKeyLister{keys: []service.APIKey{
		groupedKey("sk-grouped", 4),
		{Key: "sk-creator", Name: CreatorAPIKeyName, Status: service.StatusActive},
	}}

	got, err := resolveUserGatewayKey(context.Background(), lister, 1)
	require.NoError(t, err)
	require.Equal(t, "sk-grouped", got)
}

func TestResolveUserGatewayKeyPrefersCreatorKeyCaseInsensitive(t *testing.T) {
	creator := groupedKey("sk-creator-ci", 3)
	creator.Name = "BoxAI-Creator"
	lister := &fakeDesktopKeyLister{keys: []service.APIKey{
		groupedKey("sk-grouped", 4),
		creator,
	}}

	got, err := resolveUserGatewayKey(context.Background(), lister, 1)
	require.NoError(t, err)
	require.Equal(t, "sk-creator-ci", got)
}

func TestResolveUserGatewayKeyFallsBackToUngroupedActiveKey(t *testing.T) {
	lister := &fakeDesktopKeyLister{keys: []service.APIKey{
		{Key: "sk-dead", Status: "disabled", GroupID: ptrInt64(4)},
		{Key: "sk-nogroup", Status: service.StatusActive},
	}}

	got, err := resolveUserGatewayKey(context.Background(), lister, 1)
	require.NoError(t, err)
	require.Equal(t, "sk-nogroup", got)
}

func TestResolveUserGatewayKeyErrorsWhenNoneActive(t *testing.T) {
	lister := &fakeDesktopKeyLister{keys: []service.APIKey{{Key: "sk-dead", Status: "disabled"}}}

	_, err := resolveUserGatewayKey(context.Background(), lister, 1)
	require.Error(t, err)
}

func TestResolveUserGatewayKeyPropagatesListerError(t *testing.T) {
	lister := &fakeDesktopKeyLister{err: errors.New("db down")}

	_, err := resolveUserGatewayKey(context.Background(), lister, 1)
	require.Error(t, err)
}
