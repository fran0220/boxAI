//go:build unit

// BOXAI: browser-session adoption and audience-scoped token regressions.
package service

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/config"
	"github.com/stretchr/testify/require"
)

type atomicAdoptionCache struct {
	mu       sync.Mutex
	tokens   map[string]*RefreshTokenData
	consumes atomic.Int32
}

func (s *atomicAdoptionCache) StoreRefreshToken(_ context.Context, key string, data *RefreshTokenData, _ time.Duration) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	copy := *data
	s.tokens[key] = &copy
	return nil
}
func (s *atomicAdoptionCache) GetRefreshToken(_ context.Context, key string) (*RefreshTokenData, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	data := s.tokens[key]
	if data == nil {
		return nil, ErrRefreshTokenNotFound
	}
	copy := *data
	return &copy, nil
}
func (s *atomicAdoptionCache) DeleteRefreshToken(_ context.Context, key string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.tokens, key)
	return nil
}
func (*atomicAdoptionCache) DeleteUserRefreshTokens(context.Context, int64) error { return nil }
func (*atomicAdoptionCache) DeleteTokenFamily(context.Context, string) error      { return nil }
func (*atomicAdoptionCache) AddToUserTokenSet(context.Context, int64, string, time.Duration) error {
	return nil
}
func (*atomicAdoptionCache) AddToFamilyTokenSet(context.Context, string, string, time.Duration) error {
	return nil
}
func (*atomicAdoptionCache) GetUserTokenHashes(context.Context, int64) ([]string, error) {
	return nil, nil
}
func (*atomicAdoptionCache) GetFamilyTokenHashes(context.Context, string) ([]string, error) {
	return nil, nil
}
func (*atomicAdoptionCache) IsTokenInFamily(context.Context, string, string) (bool, error) {
	return false, nil
}
func (s *atomicAdoptionCache) ConsumeRefreshToken(_ context.Context, key string) (*RefreshTokenData, error) {
	s.consumes.Add(1)
	s.mu.Lock()
	defer s.mu.Unlock()
	data := s.tokens[key]
	if data == nil {
		return nil, ErrRefreshTokenNotFound
	}
	delete(s.tokens, key)
	copy := *data
	return &copy, nil
}

type adoptionUsers struct {
	UserRepository
	user *User
}

func (s *adoptionUsers) GetByID(context.Context, int64) (*User, error) {
	copy := *s.user
	return &copy, nil
}

func adoptionService(cache *atomicAdoptionCache, user *User) *AuthService {
	cfg := &config.Config{}
	cfg.JWT.Secret = "atomic-adoption-secret"
	cfg.JWT.AccessTokenExpireMinutes = 60
	cfg.JWT.RefreshTokenExpireDays = 7
	return NewAuthService(nil, &adoptionUsers{user: user}, nil, cache, cfg, nil, nil, nil, nil, nil, nil, nil, nil)
}

func TestAdoptLegacyBrowserSessionAtomicSingleWinner(t *testing.T) {
	user := &User{ID: 9, Email: "u@example.com", Role: "user", Status: StatusActive, TokenVersion: 2, TokenVersionResolved: true}
	raw := refreshTokenPrefix + "same-legacy-token"
	cache := &atomicAdoptionCache{tokens: map[string]*RefreshTokenData{hashToken(raw): {UserID: user.ID, TokenVersion: user.TokenVersion, FamilyID: "family", ExpiresAt: time.Now().Add(time.Hour)}}}
	svc := adoptionService(cache, user)
	start := make(chan struct{})
	errs := make(chan error, 2)
	for range 2 {
		go func() {
			<-start
			_, err := svc.AdoptLegacyBrowserSession(context.Background(), raw, BrowserSurfaceWeb)
			errs <- err
		}()
	}
	close(start)
	successes := 0
	for range 2 {
		if err := <-errs; err == nil {
			successes++
		} else {
			t.Logf("adoption result: %v", err)
		}
	}
	require.Equal(t, 1, successes)
}

func TestAdoptLegacyBrowserSessionRejectsSurfaceBoundWithoutConsume(t *testing.T) {
	user := &User{ID: 9, Email: "u@example.com", Role: "user", Status: StatusActive}
	raw := refreshTokenPrefix + "bound-token"
	cache := &atomicAdoptionCache{tokens: map[string]*RefreshTokenData{hashToken(raw): {UserID: user.ID, BrowserSurface: BrowserSurfaceConsole, ExpiresAt: time.Now().Add(time.Hour)}}}
	_, err := adoptionService(cache, user).AdoptLegacyBrowserSession(context.Background(), raw, BrowserSurfaceWeb)
	require.Error(t, err)
	require.Zero(t, cache.consumes.Load())
}
