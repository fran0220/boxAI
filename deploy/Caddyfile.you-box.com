# BoxAI production edge — 3-host topology for you-box.com
# See docs/WEB_PLATFORM.md
#
# Prerequisites:
#   - Backend (Go sub2api binary) on 127.0.0.1:8080 (console embed + API)
#   - React marketing/Creator build at /var/www/you-box.com (web/dist)
#   - DNS: you-box.com, www, console, api → this host (or CF proxy)
#
# Shared security headers (SSO authorize is zero-click — frame/XSS hardening matters):
#   Strict-Transport-Security, X-Content-Type-Options, X-Frame-Options,
#   Referrer-Policy, Permissions-Policy

(boxai_security_headers) {
	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
		X-Content-Type-Options "nosniff"
		X-Frame-Options "DENY"
		Referrer-Policy "strict-origin-when-cross-origin"
		Permissions-Policy "camera=(), microphone=(), geolocation=()"
		Content-Security-Policy "default-src 'self'; script-src 'self' https://js.stripe.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; media-src 'self' blob: https:; connect-src 'self' https: wss:; worker-src 'self' blob:; frame-src https://js.stripe.com https://hooks.stripe.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self' https:"
		# Remove server fingerprint if present
		-Server
	}
}

(boxai_proxy_upstreams) {
	header_up X-Real-IP {remote_host}
	header_up X-Forwarded-For {remote_host}
	header_up X-Forwarded-Proto {scheme}
	# BOXAI: preserve the exact public Host; never accept a client-supplied forwarded host.
	header_up Host {http.request.host}
	header_up -X-Forwarded-Host
	header_up CF-Connecting-IP {http.request.header.CF-Connecting-IP}
}

# ---------------------------------------------------------------------------
# www → apex
# ---------------------------------------------------------------------------
www.you-box.com {
	import boxai_security_headers
	redir https://you-box.com{uri} permanent
}

# ---------------------------------------------------------------------------
# Marketing + Creator (React SPA) + same-origin API/gateway proxy
# ---------------------------------------------------------------------------
you-box.com {
	import boxai_security_headers
	encode zstd gzip

	tls {
		protocols tls1.2 tls1.3
	}

	@static {
		path /assets/*
		path /logo.svg
		path /logo.png
		path /logo-mono.svg
		path /favicon.ico
	}
	header @static Cache-Control "public, max-age=31536000, immutable"

	# BOXAI: admin/setup never on apex (customer shell unification).
	handle /api/v1/admin/* {
		respond "Not Found" 404
	}
	handle /api/v1/setup* {
		respond "Not Found" 404
	}

	@apex_api {
		path /api/v1/settings/public
		path /api/v1/public/status /api/v1/public/status/*
		path /api/v1/auth/session /api/v1/auth/session/adopt /api/v1/auth/session/logout
		path /api/v1/auth/me /api/v1/auth/logout /api/v1/auth/revoke-all-sessions
		path /api/v1/auth/login /api/v1/auth/login/2fa /api/v1/auth/register
		path /api/v1/auth/registration/prepare /api/v1/auth/registration/complete
		path /api/v1/auth/send-verify-code /api/v1/auth/forgot-password /api/v1/auth/reset-password
		path /api/v1/auth/validate-promo-code /api/v1/auth/validate-invitation-code
		path /api/v1/auth/boxai/sso/authorize /api/v1/auth/boxai/sso/token
		path /api/v1/auth/boxai/desktop/authorize
		path /api/v1/boxai/creator/ensure-key
		path /api/v1/keys /api/v1/keys/*
		path /api/v1/usage /api/v1/usage/*
		path /api/v1/user /api/v1/user/*
		path /api/v1/groups /api/v1/groups/*
		path /api/v1/subscriptions /api/v1/subscriptions/*
		path /api/v1/redeem /api/v1/redeem/*
		path /api/v1/payment /api/v1/payment/*
		path /api/v1/announcements /api/v1/announcements/*
		path /api/v1/channels/available
		path /api/v1/channel-monitors /api/v1/channel-monitors/*
	}
	handle @apex_api {
		reverse_proxy 127.0.0.1:8080 {
			import boxai_proxy_upstreams
		}
	}
	handle /api/* {
		respond "Not Found" 404
	}
	handle /v1/* {
		reverse_proxy 127.0.0.1:8080 {
			import boxai_proxy_upstreams
			flush_interval -1
		}
	}
	handle /health {
		reverse_proxy 127.0.0.1:8080
	}

	handle {
		root * /var/www/you-box.com
		try_files {path} /index.html
		file_server
	}

	request_body {
		max_size 100MB
	}

	log {
		output file /var/log/caddy/you-box.com.log {
			roll_size 50mb
			roll_keep 10
			roll_keep_for 720h
		}
		format json
		level INFO
	}
}

# ---------------------------------------------------------------------------
# Console (Vue embedded in Go binary)
# ---------------------------------------------------------------------------
console.you-box.com {
	import boxai_security_headers
	encode zstd gzip

	tls {
		protocols tls1.2 tls1.3
	}

	@static {
		path /assets/*
		path /logo.png
		path /logo.svg
		path /favicon.ico
	}
	header @static Cache-Control "public, max-age=31536000, immutable"

	reverse_proxy 127.0.0.1:8080 {
		import boxai_proxy_upstreams
		health_uri /health
		health_interval 30s
		health_timeout 10s
		health_status 200
	}

	request_body {
		max_size 100MB
	}

	log {
		output file /var/log/caddy/console.you-box.com.log {
			roll_size 50mb
			roll_keep 10
			roll_keep_for 720h
		}
		format json
		level INFO
	}
}

# ---------------------------------------------------------------------------
# Public API host — edge-filtered intentional surface (NOT full /api/v1/auth/*)
#
# Allowed:
#   /v1/*                              gateway (models)
#   /api/v1/auth/boxai/sso/token       Web SSO token exchange (public)
#   /api/v1/auth/boxai/desktop/token   Desktop PKCE token exchange (public)
#   /api/v1/auth/refresh               token refresh for clients
#   /api/v1/settings/public            public site settings
#   /health
#
# Login/register/admin remain on console / apex (same-origin or console host).
# ---------------------------------------------------------------------------
api.you-box.com {
	import boxai_security_headers
	encode zstd gzip

	tls {
		protocols tls1.2 tls1.3
	}

	@allowed {
		path /v1/*
		path /api/v1/auth/boxai/sso/token
		path /api/v1/auth/boxai/desktop/token
		path /api/v1/auth/refresh
		path /api/v1/settings/public
		path /health
	}

	handle @allowed {
		reverse_proxy 127.0.0.1:8080 {
			import boxai_proxy_upstreams
			flush_interval -1
		}
	}

	handle {
		respond "Not Found" 404
	}

	request_body {
		max_size 100MB
	}

	log {
		output file /var/log/caddy/api.you-box.com.log {
			roll_size 50mb
			roll_keep 10
			roll_keep_for 720h
		}
		format json
		level INFO
	}
}
