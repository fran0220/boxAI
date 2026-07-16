//go:build unit

package handler

import (
	"crypto/sha256"
	"encoding/base64"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func challengeFor(verifier string) string {
	sum := sha256.Sum256([]byte(verifier))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}

func TestVerifyPKCEAcceptsMatchingVerifier(t *testing.T) {
	verifier := strings.Repeat("a", 43)
	require.True(t, verifyPKCE(challengeFor(verifier), verifier))
}

func TestVerifyPKCERejectsWrongVerifier(t *testing.T) {
	verifier := strings.Repeat("a", 43)
	require.False(t, verifyPKCE(challengeFor(verifier), strings.Repeat("b", 43)))
}

func TestVerifyPKCERejectsEmptyOrShort(t *testing.T) {
	verifier := strings.Repeat("a", 43)
	challenge := challengeFor(verifier)
	require.False(t, verifyPKCE(challenge, ""))
	require.False(t, verifyPKCE(challenge, "short"))
	require.False(t, verifyPKCE("", verifier))
}

func TestIsValidPKCEChallenge(t *testing.T) {
	valid := challengeFor(strings.Repeat("a", 43))
	require.True(t, isValidPKCEChallenge(valid))
	require.False(t, isValidPKCEChallenge("too-short"))
	require.False(t, isValidPKCEChallenge(strings.Repeat("a", 200)))
	require.False(t, isValidPKCEChallenge(strings.Repeat("!", 43)))
}

func TestIsAllowedDesktopRedirectURI(t *testing.T) {
	require.True(t, isAllowedDesktopRedirectURI("boxai-desktop://auth/callback"))
	require.True(t, isAllowedDesktopRedirectURI("BOXAI-DESKTOP://auth/callback"))
	require.False(t, isAllowedDesktopRedirectURI("https://evil.example.com/callback"))
	require.False(t, isAllowedDesktopRedirectURI("boxai://auth/callback"))
	require.False(t, isAllowedDesktopRedirectURI(""))
}

func TestNewDesktopAuthCodeIsUniqueAndDecodable(t *testing.T) {
	seen := make(map[string]struct{}, 100)
	for i := 0; i < 100; i++ {
		code, err := newDesktopAuthCode()
		require.NoError(t, err)
		require.NotEmpty(t, code)
		_, decodeErr := base64.RawURLEncoding.DecodeString(code)
		require.NoError(t, decodeErr)
		_, dup := seen[code]
		require.False(t, dup, "codes must be unique")
		seen[code] = struct{}{}
	}
}
