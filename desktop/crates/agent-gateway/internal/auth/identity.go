// BOXAI: token identity resolution for multi-tenant gateway deployments.
//
// Every authenticated surface (HTTP API, browser WebSockets, gRPC metadata,
// and the agent Authenticate RPC) can resolve the caller to an Identity:
// the static shared token maps to the reserved "local" tenant, while boxAI
// account JWTs map to a per-user tenant derived from /api/v1/auth/me.
package auth

import (
	"context"
	"strings"

	"google.golang.org/grpc/metadata"
)

const (
	MethodStatic = "static"
	MethodBoxAI  = "boxai"

	// LocalTenantID is the tenant every static shared-token caller shares.
	// In single-tenant deployments it is the only tenant.
	LocalTenantID = "local"
)

type Identity struct {
	Method string
	// UserID is the boxAI account id; empty for static-token callers and for
	// boxAI tokens whose profile response carried no parseable id.
	UserID string
}

type TokenRevalidationStatus uint8

const (
	// TokenRevalidationUnavailable means the authority could not make a
	// definitive decision (timeout, transport failure, rate limit, or 5xx).
	TokenRevalidationUnavailable TokenRevalidationStatus = iota
	TokenRevalidationValid
	TokenRevalidationInvalid
)

// TenantID returns the session-isolation key for this identity. An empty
// string means the identity cannot be scoped to a tenant and must not be
// granted access in multi-tenant mode.
func (id Identity) TenantID() string {
	switch id.Method {
	case MethodStatic:
		return LocalTenantID
	case MethodBoxAI:
		if id.UserID != "" {
			return "user:" + id.UserID
		}
		return ""
	default:
		return ""
	}
}

// ResolveToken authenticates value against the static shared token first and
// the boxAI account validator second, returning who the caller is.
func ResolveToken(value, expectedToken string) (Identity, bool) {
	return ResolveTokenWithPolicy(value, expectedToken, true)
}

// ResolveTokenWithPolicy optionally disables the static shared credential.
// Hosted multi-tenant deployments use allowStatic=false so callers cannot
// accidentally converge on the reserved local tenant.
func ResolveTokenWithPolicy(value, expectedToken string, allowStatic bool) (Identity, bool) {
	value = strings.TrimSpace(value)
	if value == "" {
		return Identity{}, false
	}
	if allowStatic && matchesStaticToken(value, expectedToken) {
		return Identity{Method: MethodStatic}, true
	}
	if userID, ok := resolveBoxAIToken(value); ok {
		return Identity{Method: MethodBoxAI, UserID: userID}, true
	}
	return Identity{}, false
}

// RevalidateTokenWithPolicy is the non-cached counterpart used by long-lived
// hosted transports. Static standalone credentials retain their existing
// behavior; BoxAI JWTs are checked against /api/v1/auth/me again.
func RevalidateTokenWithPolicy(value, expectedToken string, allowStatic bool) (Identity, TokenRevalidationStatus) {
	value = strings.TrimSpace(value)
	if value == "" {
		return Identity{}, TokenRevalidationInvalid
	}
	if allowStatic && matchesStaticToken(value, expectedToken) {
		return Identity{Method: MethodStatic}, TokenRevalidationValid
	}
	userID, result := revalidateBoxAIToken(value)
	if result == TokenRevalidationValid {
		return Identity{Method: MethodBoxAI, UserID: userID}, result
	}
	return Identity{}, result
}

// ResolveBearerHeader parses an "Authorization: Bearer <token>" header value
// and resolves the token to an identity.
func ResolveBearerHeader(headerValue, expectedToken string) (Identity, bool) {
	return ResolveBearerHeaderWithPolicy(headerValue, expectedToken, true)
}

func ResolveBearerHeaderWithPolicy(headerValue, expectedToken string, allowStatic bool) (Identity, bool) {
	token, ok := bearerToken(headerValue)
	if !ok {
		return Identity{}, false
	}
	return ResolveTokenWithPolicy(token, expectedToken, allowStatic)
}

// ResolveGRPCContext resolves the caller identity from incoming gRPC metadata
// ("authorization" bearer values or bare "token" values).
func ResolveGRPCContext(ctx context.Context, expectedToken string) (Identity, bool) {
	return ResolveGRPCContextWithPolicy(ctx, expectedToken, true)
}

func ResolveGRPCContextWithPolicy(ctx context.Context, expectedToken string, allowStatic bool) (Identity, bool) {
	identity, _, ok := ResolveGRPCCredentialWithPolicy(ctx, expectedToken, allowStatic)
	return identity, ok
}

// ResolveGRPCCredentialWithPolicy returns the normalized raw credential as
// well as its identity so stream handlers can periodically revalidate it.
func ResolveGRPCCredentialWithPolicy(ctx context.Context, expectedToken string, allowStatic bool) (Identity, string, bool) {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return Identity{}, "", false
	}
	for _, value := range md.Get("authorization") {
		token, parsed := bearerToken(value)
		if !parsed {
			continue
		}
		if identity, resolved := ResolveTokenWithPolicy(token, expectedToken, allowStatic); resolved {
			return identity, strings.TrimSpace(token), true
		}
	}
	for _, value := range md.Get("token") {
		if identity, resolved := ResolveTokenWithPolicy(value, expectedToken, allowStatic); resolved {
			return identity, strings.TrimSpace(value), true
		}
	}
	return Identity{}, "", false
}

type identityContextKey struct{}

func WithIdentity(ctx context.Context, identity Identity) context.Context {
	return context.WithValue(ctx, identityContextKey{}, identity)
}

func IdentityFromContext(ctx context.Context) (Identity, bool) {
	identity, ok := ctx.Value(identityContextKey{}).(Identity)
	return identity, ok
}

func bearerToken(headerValue string) (string, bool) {
	headerValue = strings.TrimSpace(headerValue)
	if headerValue == "" {
		return "", false
	}
	parts := strings.SplitN(headerValue, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		return "", false
	}
	return parts[1], true
}
