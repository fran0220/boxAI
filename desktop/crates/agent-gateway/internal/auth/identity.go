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
	value = strings.TrimSpace(value)
	if value == "" {
		return Identity{}, false
	}
	if matchesStaticToken(value, expectedToken) {
		return Identity{Method: MethodStatic}, true
	}
	if userID, ok := resolveBoxAIToken(value); ok {
		return Identity{Method: MethodBoxAI, UserID: userID}, true
	}
	return Identity{}, false
}

// ResolveBearerHeader parses an "Authorization: Bearer <token>" header value
// and resolves the token to an identity.
func ResolveBearerHeader(headerValue, expectedToken string) (Identity, bool) {
	token, ok := bearerToken(headerValue)
	if !ok {
		return Identity{}, false
	}
	return ResolveToken(token, expectedToken)
}

// ResolveGRPCContext resolves the caller identity from incoming gRPC metadata
// ("authorization" bearer values or bare "token" values).
func ResolveGRPCContext(ctx context.Context, expectedToken string) (Identity, bool) {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return Identity{}, false
	}
	for _, value := range md.Get("authorization") {
		if identity, resolved := ResolveBearerHeader(value, expectedToken); resolved {
			return identity, true
		}
	}
	for _, value := range md.Get("token") {
		if identity, resolved := ResolveToken(value, expectedToken); resolved {
			return identity, true
		}
	}
	return Identity{}, false
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
