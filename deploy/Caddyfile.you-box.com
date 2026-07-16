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
		# Remove server fingerprint if present
		-Server
	}
}

(boxai_proxy_upstreams) {
	header_up X-Real-IP {remote_host}
	header_up X-Forwarded-For {remote_host}
	header_up X-Forwarded-Proto {scheme}
	header_up X-Forwarded-Host {host}
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

	handle /api/* {
		reverse_proxy 127.0.0.1:8080 {
			import boxai_proxy_upstreams
		}
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
