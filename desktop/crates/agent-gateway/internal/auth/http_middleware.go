package auth

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/json"
	"net/http"
	"strings"
)

// HTTPMiddleware rejects requests without a valid bearer token and annotates
// accepted requests with the resolved caller identity.
func HTTPMiddleware(expectedToken string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		identity, ok := ResolveBearerHeader(r.Header.Get("Authorization"), expectedToken)
		if !ok {
			writeJSONError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		next.ServeHTTP(w, r.WithContext(WithIdentity(r.Context(), identity)))
	})
}

func ValidateBearerHeader(headerValue, expectedToken string) bool {
	_, ok := ResolveBearerHeader(headerValue, expectedToken)
	return ok
}

func ValidateToken(value, expectedToken string) bool {
	_, ok := ResolveToken(value, expectedToken)
	return ok
}

func matchesStaticToken(value, expectedToken string) bool {
	value = strings.TrimSpace(value)
	expectedToken = strings.TrimSpace(expectedToken)
	if value == "" || expectedToken == "" {
		return false
	}
	valueHash := sha256.Sum256([]byte(value))
	expectedHash := sha256.Sum256([]byte(expectedToken))
	return subtle.ConstantTimeCompare(valueHash[:], expectedHash[:]) == 1
}

func writeJSONError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"error": message,
	})
}
