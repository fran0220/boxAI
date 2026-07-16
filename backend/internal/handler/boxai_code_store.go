package handler

// BOXAI: abstraction so desktop/web SSO handlers can use Redis without
// importing go-redis (handler depguard forbids repository/redis imports).

import (
	"context"
	"errors"
	"time"
)

// ErrBoxAICodeNotFound is returned by BoxAICodeStore.Take when the code is
// missing or already consumed.
var ErrBoxAICodeNotFound = errors.New("boxai auth code not found")

// BoxAICodeStore is a short-lived single-use code store (Set + atomic GetDel).
// Implemented outside handler (typically Redis) so this package stays depguard-clean.
type BoxAICodeStore interface {
	Put(ctx context.Context, key, value string, ttl time.Duration) error
	// Take removes and returns the value, or ErrBoxAICodeNotFound.
	Take(ctx context.Context, key string) (string, error)
}

// BOXAI: Stores implementing this extension allow binding checks before the
// atomic Take, so invalid exchange attempts cannot burn a valid code.
type BoxAICodeVerifyingStore interface {
	BoxAICodeStore
	Get(ctx context.Context, key string) (string, error)
}
