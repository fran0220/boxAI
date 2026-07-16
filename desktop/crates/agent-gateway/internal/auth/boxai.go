// BOXAI: optional boxAI-account JWT validation for the gateway.
//
// When a boxAI server URL is configured (BOXAI_SERVER_URL / -boxai-server-url),
// every token entry point (HTTP API, browser WebSocket payloads, gRPC metadata,
// and the agent Authenticate RPC) accepts a boxAI access token in addition to
// the static shared token. Tokens are verified by calling the boxAI server's
// authenticated profile endpoint (/api/v1/auth/me) and results are cached
// briefly so repeated requests do not hammer the server.
package auth

import (
	"crypto/sha256"
	"net/http"
	"strings"
	"sync"
	"time"
)

const (
	boxaiPositiveTTL    = time.Minute
	boxaiNegativeTTL    = 10 * time.Second
	boxaiRequestTimeout = 10 * time.Second
	boxaiCacheMaxSize   = 1024
)

type boxaiCacheEntry struct {
	ok      bool
	expires time.Time
}

type BoxAIValidator struct {
	serverURL string
	client    *http.Client

	mu    sync.Mutex
	cache map[[32]byte]boxaiCacheEntry
}

// NewBoxAIValidator returns nil when serverURL is empty (feature disabled).
func NewBoxAIValidator(serverURL string) *BoxAIValidator {
	trimmed := strings.TrimRight(strings.TrimSpace(serverURL), "/")
	if trimmed == "" {
		return nil
	}
	return &BoxAIValidator{
		serverURL: trimmed,
		client:    &http.Client{Timeout: boxaiRequestTimeout},
		cache:     make(map[[32]byte]boxaiCacheEntry),
	}
}

// looksLikeJWT keeps arbitrary shared-token guesses from being forwarded to
// the boxAI server; only three-segment dotted tokens are checked upstream.
func looksLikeJWT(token string) bool {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return false
	}
	for _, part := range parts {
		if part == "" {
			return false
		}
	}
	return true
}

func (v *BoxAIValidator) Validate(token string) bool {
	if v == nil {
		return false
	}
	token = strings.TrimSpace(token)
	if token == "" || !looksLikeJWT(token) {
		return false
	}

	key := sha256.Sum256([]byte(token))
	now := time.Now()

	v.mu.Lock()
	if entry, found := v.cache[key]; found && now.Before(entry.expires) {
		v.mu.Unlock()
		return entry.ok
	}
	v.mu.Unlock()

	ok := v.check(token)

	ttl := boxaiNegativeTTL
	if ok {
		ttl = boxaiPositiveTTL
	}
	v.mu.Lock()
	if len(v.cache) >= boxaiCacheMaxSize {
		for cachedKey := range v.cache {
			delete(v.cache, cachedKey)
			if len(v.cache) < boxaiCacheMaxSize/2 {
				break
			}
		}
	}
	v.cache[key] = boxaiCacheEntry{ok: ok, expires: now.Add(ttl)}
	v.mu.Unlock()

	return ok
}

func (v *BoxAIValidator) check(token string) bool {
	req, err := http.NewRequest(http.MethodGet, v.serverURL+"/api/v1/auth/me", nil)
	if err != nil {
		return false
	}
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := v.client.Do(req)
	if err != nil {
		return false
	}
	defer func() { _ = resp.Body.Close() }()
	return resp.StatusCode == http.StatusOK
}

var (
	boxaiMu     sync.RWMutex
	boxaiGlobal *BoxAIValidator
)

// ConfigureBoxAI installs (or, with an empty URL, disables) the process-wide
// boxAI validator used as a fallback by ValidateToken.
func ConfigureBoxAI(serverURL string) {
	validator := NewBoxAIValidator(serverURL)
	boxaiMu.Lock()
	boxaiGlobal = validator
	boxaiMu.Unlock()
}

func validateBoxAIToken(token string) bool {
	boxaiMu.RLock()
	validator := boxaiGlobal
	boxaiMu.RUnlock()
	return validator.Validate(token)
}
