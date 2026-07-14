// Package branding holds BoxAI product identity constants for the backend.
//
// BOXAI: This package is product-first and is never expected from upstream.
// Upstream files should import ProductName (or related helpers) instead of
// hard-coding "BoxAI" / "Sub2API" display defaults, and mark each call site
// with a // BOXAI: comment so merges stay replayable.
package branding

// ProductName is the official product display name (one word: capital B + AI).
const ProductName = "BoxAI"

// ProductTagline is the short product descriptor used in titles/defaults.
const ProductTagline = "AI API Gateway"

// DocumentTitle is the default document / browser title.
const DocumentTitle = ProductName + " - " + ProductTagline

// UpdateGitHubRepo is the GitHub owner/name used by the admin in-app update checker.
// BOXAI: must NOT point at Wei-Shaw/sub2api or upgrades will replace the product binary.
const UpdateGitHubRepo = "fran0220/boxAI"

// DefaultPublicImage is the GHCR image name for compose-based production deploys.
const DefaultPublicImage = "ghcr.io/fran0220/boxai"

// SubscriptionSubjectPrefix is used when building payment subjects for plans
// without an explicit product name.
func SubscriptionSubjectPrefix() string {
	return ProductName + " Subscription "
}

// BalanceTopUpSubject builds a default top-up payment subject.
func BalanceTopUpSubject(amountStr, currency string) string {
	return ProductName + " " + amountStr + " " + currency
}
