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
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

const (
	boxaiPositiveTTL     = time.Minute
	boxaiNegativeTTL     = 10 * time.Second
	boxaiRequestTimeout  = 10 * time.Second
	boxaiCacheMaxSize    = 1024
	boxaiProfileMaxBytes = 1 << 20
)

type boxaiCacheEntry struct {
	ok      bool
	userID  string
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
	_, ok := v.Resolve(token)
	return ok
}

// Resolve validates the token and returns the boxAI account id it belongs to.
// The user id is empty when the profile response carried no parseable id.
func (v *BoxAIValidator) Resolve(token string) (string, bool) {
	if v == nil {
		return "", false
	}
	token = strings.TrimSpace(token)
	if token == "" || !looksLikeJWT(token) {
		return "", false
	}

	key := sha256.Sum256([]byte(token))
	now := time.Now()

	v.mu.Lock()
	if entry, found := v.cache[key]; found && now.Before(entry.expires) {
		v.mu.Unlock()
		return entry.userID, entry.ok
	}
	v.mu.Unlock()

	userID, ok := v.check(token)

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
	v.cache[key] = boxaiCacheEntry{ok: ok, userID: userID, expires: now.Add(ttl)}
	v.mu.Unlock()

	return userID, ok
}

func (v *BoxAIValidator) check(token string) (string, bool) {
	req, err := http.NewRequest(http.MethodGet, v.serverURL+"/api/v1/auth/me", nil)
	if err != nil {
		return "", false
	}
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := v.client.Do(req)
	if err != nil {
		return "", false
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return "", false
	}
	return parseBoxAIProfileUserID(resp.Body), true
}

// parseBoxAIProfileUserID extracts data.id from the /api/v1/auth/me envelope
// ({"code":0,"data":{"id":...}}). A missing or unparseable id degrades to an
// empty user id: the token stays valid for single-tenant auth, but cannot be
// scoped to a tenant.
func parseBoxAIProfileUserID(body io.Reader) string {
	var envelope struct {
		Data struct {
			ID json.Number `json:"id"`
		} `json:"data"`
	}
	decoder := json.NewDecoder(io.LimitReader(body, boxaiProfileMaxBytes))
	if err := decoder.Decode(&envelope); err != nil {
		return ""
	}
	id := strings.TrimSpace(envelope.Data.ID.String())
	if id == "" || id == "0" {
		return ""
	}
	return id
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

func resolveBoxAIToken(token string) (string, bool) {
	boxaiMu.RLock()
	validator := boxaiGlobal
	boxaiMu.RUnlock()
	return validator.Resolve(token)
}
