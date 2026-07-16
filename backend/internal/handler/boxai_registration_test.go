//go:build unit

package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/config"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"
)

type registrationStoreStub struct {
	values map[string]string
	gets   int
	takes  int
}

type registrationUserRepoStub struct {
	service.UserRepository
	created *service.User
}

func (s *registrationUserRepoStub) ExistsByEmail(context.Context, string) (bool, error) {
	return s.created != nil, nil
}

func (s *registrationUserRepoStub) Create(_ context.Context, user *service.User) error {
	user.ID = 1
	s.created = user
	return nil
}

func (s *registrationStoreStub) Put(_ context.Context, key, value string, _ time.Duration) error {
	if s.values == nil {
		s.values = make(map[string]string)
	}
	s.values[key] = value
	return nil
}

func (s *registrationStoreStub) Get(_ context.Context, key string) (string, error) {
	s.gets++
	value, ok := s.values[key]
	if !ok {
		return "", ErrBoxAICodeNotFound
	}
	return value, nil
}

func (s *registrationStoreStub) Take(_ context.Context, key string) (string, error) {
	s.takes++
	value, ok := s.values[key]
	if !ok {
		return "", ErrBoxAICodeNotFound
	}
	delete(s.values, key)
	return value, nil
}

func invokeRegistrationComplete(t *testing.T, handler gin.HandlerFunc, body any) *httptest.ResponseRecorder {
	t.Helper()
	payload, err := json.Marshal(body)
	require.NoError(t, err)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/v1/auth/registration/complete", bytes.NewReader(payload))
	ctx.Request.Header.Set("Content-Type", "application/json")
	handler(ctx)
	return recorder
}

func preparedRegistrationRecord(t *testing.T, email, password string) string {
	t.Helper()
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	require.NoError(t, err)
	record, err := json.Marshal(registrationTransaction{Email: email, PasswordHash: string(hash)})
	require.NoError(t, err)
	require.NotContains(t, string(record), password)
	require.NotContains(t, string(record), "turnstile")
	return string(record)
}

func registrationTestHandler(cache service.EmailCache) *AuthHandler {
	cfg := &config.Config{JWT: config.JWTConfig{
		Secret: "registration-test-secret", AccessTokenExpireMinutes: 60, RefreshTokenExpireDays: 7,
	}}
	settings := &oauthPendingFlowSettingRepoStub{values: map[string]string{
		service.SettingKeyRegistrationEnabled:              "true",
		service.SettingKeyEmailVerifyEnabled:               "true",
		service.SettingKeyInvitationCodeEnabled:            "false",
		service.SettingKeyRegistrationEmailSuffixWhitelist: "[]",
	}}
	settingService := service.NewSettingService(settings, cfg)
	authService := service.NewAuthService(
		nil,
		&registrationUserRepoStub{},
		nil,
		&oauthPendingFlowRefreshTokenCacheStub{},
		cfg,
		settingService,
		service.NewEmailService(settings, cache),
		nil,
		nil,
		nil,
		nil,
		nil,
		nil,
	)
	return &AuthHandler{cfg: cfg, authService: authService, settingSvc: settingService}
}

func TestBoxAIRegistrationCompleteRejectsInvalidTransactionIDBeforeStoreLookup(t *testing.T) {
	gin.SetMode(gin.TestMode)
	store := &registrationStoreStub{values: make(map[string]string)}
	handler := (&AuthHandler{}).BoxAIRegistrationComplete(store)

	recorder := invokeRegistrationComplete(t, handler, map[string]string{
		"transaction_id": "not-a-valid-id",
		"verify_code":    "123456",
	})

	require.Equal(t, http.StatusBadRequest, recorder.Code)
	require.Zero(t, store.gets)
	require.Zero(t, store.takes)
}

func TestBoxAIRegistrationCompleteWrongCodeDoesNotConsumeTransaction(t *testing.T) {
	gin.SetMode(gin.TestMode)
	email := "wrong-code@example.com"
	cache := &oauthPendingFlowEmailCacheStub{verificationCodes: map[string]*service.VerificationCodeData{
		email: {Code: "123456", ExpiresAt: time.Now().Add(15 * time.Minute)},
	}}
	h := registrationTestHandler(cache)
	id, err := newRegistrationTransactionID()
	require.NoError(t, err)
	key := registrationTransactionKey(id)
	store := &registrationStoreStub{values: map[string]string{key: preparedRegistrationRecord(t, email, "secret-123")}}

	recorder := invokeRegistrationComplete(t, h.BoxAIRegistrationComplete(store), map[string]string{
		"transaction_id": id,
		"verify_code":    "000000",
	})

	require.Equal(t, http.StatusBadRequest, recorder.Code)
	require.Zero(t, store.gets)
	require.Equal(t, 1, store.takes)
	require.Contains(t, store.values, key)
}

func TestBoxAIRegistrationCompleteConsumesTransactionAndReturnsSession(t *testing.T) {
	gin.SetMode(gin.TestMode)
	email := "complete@example.com"
	cache := &oauthPendingFlowEmailCacheStub{verificationCodes: map[string]*service.VerificationCodeData{
		email: {Code: "123456", ExpiresAt: time.Now().Add(15 * time.Minute)},
	}}
	h := registrationTestHandler(cache)
	id, err := newRegistrationTransactionID()
	require.NoError(t, err)
	key := registrationTransactionKey(id)
	store := &registrationStoreStub{values: map[string]string{key: preparedRegistrationRecord(t, email, "secret-123")}}

	recorder := invokeRegistrationComplete(t, h.BoxAIRegistrationComplete(store), map[string]string{
		"transaction_id": id,
		"verify_code":    "123456",
	})

	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	require.Zero(t, store.gets)
	require.Equal(t, 1, store.takes)
	require.NotContains(t, store.values, key)
	require.NotContains(t, recorder.Body.String(), "secret-123")

	second := invokeRegistrationComplete(t, h.BoxAIRegistrationComplete(store), map[string]string{
		"transaction_id": id,
		"verify_code":    "123456",
	})
	require.Equal(t, http.StatusBadRequest, second.Code)
	require.Equal(t, 2, store.takes)
}
