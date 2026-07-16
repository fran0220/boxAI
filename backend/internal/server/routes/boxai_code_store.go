package routes

// BOXAI: Redis adapter for handler.BoxAICodeStore (handler cannot import go-redis).

import (
	"context"
	"errors"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/handler"
	"github.com/redis/go-redis/v9"
)

type redisBoxAICodeStore struct {
	rdb *redis.Client
}

// NewBoxAICodeStore wraps a redis client for desktop/web SSO code storage.
// Returns nil when rdb is nil so handlers can surface "store unavailable".
func NewBoxAICodeStore(rdb *redis.Client) handler.BoxAICodeStore {
	if rdb == nil {
		return nil
	}
	return &redisBoxAICodeStore{rdb: rdb}
}

func (s *redisBoxAICodeStore) Put(ctx context.Context, key, value string, ttl time.Duration) error {
	return s.rdb.Set(ctx, key, value, ttl).Err()
}

func (s *redisBoxAICodeStore) Take(ctx context.Context, key string) (string, error) {
	val, err := s.rdb.GetDel(ctx, key).Result()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return "", handler.ErrBoxAICodeNotFound
		}
		return "", err
	}
	if val == "" {
		return "", handler.ErrBoxAICodeNotFound
	}
	return val, nil
}
