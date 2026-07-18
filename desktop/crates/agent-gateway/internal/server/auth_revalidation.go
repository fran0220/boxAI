package server

import (
	"github.com/liveagent/agent-gateway/internal/auth"
	"github.com/liveagent/agent-gateway/internal/config"
)

const authRevalidationUnknownLimit = 3

// hostedCredentialRevalidator distinguishes definitive token rejection from a
// temporary control-plane outage. It fails closed after a bounded number of
// consecutive unknown results, but does not turn one deploy/network blip into
// a mass disconnect or poison the validator's negative cache.
type hostedCredentialRevalidator struct {
	cfg                *config.Config
	token              string
	identity           auth.Identity
	consecutiveUnknown int
}

func newHostedCredentialRevalidator(
	cfg *config.Config,
	token string,
	identity auth.Identity,
) *hostedCredentialRevalidator {
	if identity.Method != auth.MethodBoxAI {
		return nil
	}
	return &hostedCredentialRevalidator{cfg: cfg, token: token, identity: identity}
}

func (r *hostedCredentialRevalidator) shouldTerminate() bool {
	identity, result := auth.RevalidateTokenWithPolicy(
		r.token,
		r.cfg.Token,
		r.cfg.AllowStaticToken(),
	)
	switch result {
	case auth.TokenRevalidationValid:
		r.consecutiveUnknown = 0
		return identity != r.identity
	case auth.TokenRevalidationInvalid:
		return true
	default:
		r.consecutiveUnknown++
		return r.consecutiveUnknown >= authRevalidationUnknownLimit
	}
}
