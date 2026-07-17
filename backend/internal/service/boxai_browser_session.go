package service

// BOXAI: Host-bound browser session support, deliberately layered on the
// existing hashed refresh-token cache so there is only one revocation model.

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const (
	BrowserSurfaceWeb     = "web"
	BrowserSurfaceConsole = "console"
)

var ErrBrowserSessionSurface = errors.New("browser session is not valid for this site")

type BrowserSession struct {
	AccessToken   string
	SessionToken  string
	ExpiresIn     int
	SessionMaxAge int
	User          *User
}

func validBrowserSurface(surface string) bool {
	return surface == BrowserSurfaceWeb || surface == BrowserSurfaceConsole
}

// GenerateTokenForAudienceScope creates a short-lived, surface-restricted JWT.
func (s *AuthService) GenerateTokenForAudienceScope(user *User, audience string, scopes []string) (string, error) {
	if !validBrowserSurface(audience) {
		return "", ErrBrowserSessionSurface
	}
	now := time.Now()
	expiresAt := now.Add(time.Duration(s.GetAccessTokenExpiresIn()) * time.Second)
	claims := &JWTClaims{UserID: user.ID, Email: user.Email, Role: user.Role,
		TokenVersion: resolvedTokenVersion(user), Scope: strings.Join(scopes, " "),
		RegisteredClaims: jwt.RegisteredClaims{Issuer: "boxai", Audience: jwt.ClaimStrings{audience}, ExpiresAt: jwt.NewNumericDate(expiresAt), IssuedAt: jwt.NewNumericDate(now), NotBefore: jwt.NewNumericDate(now)}}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(s.cfg.JWT.Secret))
	if err != nil {
		return "", fmt.Errorf("sign token: %w", err)
	}
	return token, nil
}

func browserScopes(user *User, surface string) []string {
	// BOXAI: customer shell is apex-only — no cross-origin "sso" scope.
	if surface == BrowserSurfaceWeb {
		return []string{"web", "creator"}
	}
	scopes := []string{"console", "user"}
	if user.IsAdmin() {
		scopes = append(scopes, "admin")
	}
	return scopes
}

func (s *AuthService) storeBrowserSession(ctx context.Context, user *User, surface, familyID string) (*BrowserSession, error) {
	raw, err := s.generateRefreshToken(ctx, user, familyID)
	if err != nil {
		return nil, err
	}
	hash := hashToken(raw)
	data, err := s.refreshTokenCache.GetRefreshToken(ctx, hash)
	if err != nil {
		_ = s.refreshTokenCache.DeleteRefreshToken(ctx, hash)
		return nil, err
	}
	data.BrowserSurface = surface
	ttl := time.Until(data.ExpiresAt)
	if err := s.refreshTokenCache.StoreRefreshToken(ctx, hash, data, ttl); err != nil {
		return nil, err
	}
	access, err := s.GenerateTokenForAudienceScope(user, surface, browserScopes(user, surface))
	if err != nil {
		_ = s.refreshTokenCache.DeleteRefreshToken(ctx, hash)
		return nil, err
	}
	return &BrowserSession{AccessToken: access, SessionToken: raw, ExpiresIn: s.GetAccessTokenExpiresIn(), SessionMaxAge: int(ttl.Seconds()), User: user}, nil
}

func (s *AuthService) GenerateBrowserSession(ctx context.Context, user *User, surface string) (*BrowserSession, error) {
	if s.refreshTokenCache == nil || !validBrowserSurface(surface) {
		return nil, ErrBrowserSessionSurface
	}
	return s.storeBrowserSession(ctx, user, surface, "")
}

// ResumeBrowserSession does not rotate or rewrite the stable cookie token.
func (s *AuthService) ResumeBrowserSession(ctx context.Context, token, surface string) (*BrowserSession, error) {
	if s.refreshTokenCache == nil || !validBrowserSurface(surface) || !strings.HasPrefix(token, refreshTokenPrefix) {
		return nil, ErrRefreshTokenInvalid
	}
	data, err := s.refreshTokenCache.GetRefreshToken(ctx, hashToken(token))
	if err != nil {
		return nil, ErrRefreshTokenInvalid
	}
	if data.BrowserSurface != surface {
		return nil, ErrBrowserSessionSurface
	}
	if time.Now().After(data.ExpiresAt) {
		_ = s.refreshTokenCache.DeleteRefreshToken(ctx, hashToken(token))
		return nil, ErrRefreshTokenExpired
	}
	user, err := s.userRepo.GetByID(ctx, data.UserID)
	if err != nil || !user.IsActive() || data.TokenVersion != resolvedTokenVersion(user) {
		return nil, ErrRefreshTokenInvalid
	}
	access, err := s.GenerateTokenForAudienceScope(user, surface, browserScopes(user, surface))
	if err != nil {
		return nil, err
	}
	return &BrowserSession{AccessToken: access, SessionToken: token, ExpiresIn: s.GetAccessTokenExpiresIn(), SessionMaxAge: int(time.Until(data.ExpiresAt).Seconds()), User: user}, nil
}

func (s *AuthService) AdoptLegacyBrowserSession(ctx context.Context, token, surface string) (*BrowserSession, error) {
	if s.refreshTokenCache == nil || !validBrowserSurface(surface) || !strings.HasPrefix(token, refreshTokenPrefix) {
		return nil, ErrRefreshTokenInvalid
	}
	hash := hashToken(token)
	data, err := s.refreshTokenCache.GetRefreshToken(ctx, hash)
	if err != nil || data.BrowserSurface != "" {
		return nil, ErrBrowserSessionSurface
	}
	user, err := s.userRepo.GetByID(ctx, data.UserID)
	if err != nil || !user.IsActive() || data.TokenVersion != resolvedTokenVersion(user) {
		return nil, ErrRefreshTokenInvalid
	}
	// BOXAI: Validate before consuming, then ensure the atomically consumed value
	// is exactly the record validated above. Surface-bound records are never consumed.
	if consumer, ok := s.refreshTokenCache.(AtomicRefreshTokenConsumer); ok {
		consumed, consumeErr := consumer.ConsumeRefreshToken(ctx, hash)
		if consumeErr != nil || !reflect.DeepEqual(consumed, data) {
			return nil, ErrRefreshTokenInvalid
		}
	} else {
		// Conservative compatibility for upstream unit stubs.
		if err := s.refreshTokenCache.DeleteRefreshToken(ctx, hash); err != nil {
			return nil, err
		}
	}
	return s.storeBrowserSession(ctx, user, surface, data.FamilyID)
}
