# BoxAI Desktop — Vendored Upstream

This tree is a **vendored, productized copy** of BoxLiveAgent (a fork of
`Stack-Cairn/LiveAgent`), integrated into boxAI as the **BoxAI Desktop** office app.

| Item | Value |
|------|-------|
| Upstream repo | https://github.com/fran0220/BoxLiveAgent |
| Upstream of upstream | https://github.com/Stack-Cairn/LiveAgent |
| Vendored at commit | `8dc4b9d830af9d2a5549d7d10c267019d22ef90f` (2026-07-15) |
| Vendoring method | plain copy (no submodule, `.git` excluded) |

## Integration policy

- This is a **fork-owned, product-first** tree. Rebrand and product edits here do
  not need `// BOXAI:` markers (unlike boxAI's sync-first backend/frontend).
- Product identity is **BoxAI Desktop**; upstream product name was `LiveAgent`.
- Auth: boxAI accounts (JWT). No local API keys or custom AI providers.
- Runtime: single `@earendil-works/pi-ai` engine talking only to boxAI
  (Anthropic-compatible `/v1/messages` and OpenAI-compatible `/v1/chat/completions`).

## BoxAI product deltas

Enumerated product changes on top of the vendored tree (beyond branding):

### Account login / session (browser OAuth, PKCE)

- `crates/agent-gui/src/lib/boxaiAuth/pkce.ts` — PKCE (S256) verifier/challenge/state.
- `crates/agent-gui/src/lib/boxaiAuth/session.ts` — local BoxAI session persistence.
- `crates/agent-gui/src/lib/boxaiAuth/client.ts` — code exchange + token refresh against
  `<server>/api/v1/auth/boxai/desktop/token` and `/api/v1/auth/refresh`.
- `crates/agent-gui/src/lib/boxaiAuth/login.ts` — opens the system browser at
  `<server>/desktop-auth?...` and parses the `boxai-desktop://auth/callback` redirect.
- `crates/agent-gui/src/components/BoxAILogin.tsx` — server-URL + browser sign-in screen
  (with a manual redirect-link paste fallback).
- `crates/agent-gui/src/App.tsx` — gates the app on a BoxAI session; refreshes an expired
  access token on boot.

### Locked BoxAI providers + settings lockdown

- `crates/agent-gui/src/lib/boxaiAuth/models.ts` — curated model catalog per transport.
- `crates/agent-gui/src/lib/boxaiAuth/provider.ts` — builds the two locked providers
  (`BoxAI (Claude)` = `claude_code`, `BoxAI (OpenAI)` = `codex`), both pointing at
  `<server>/v1` with the JWT as the credential; `providersMatchSession` no-op guard.
- `crates/agent-gui/src/App.tsx` — reconciles the locked providers + a valid selected
  model from the session; hides the settings "providers" section; passes the account
  block (with sign-out) to the settings page.
- `crates/agent-gui/src/pages/SettingsPage.tsx` + `pages/settings/types.ts` — optional
  `account` control rendering the signed-in user/server + a **Sign out** button.

### Deep-link auto-return

- `crates/agent-gui/src-tauri/Cargo.toml` — adds `tauri-plugin-deep-link` +
  `tauri-plugin-single-instance` (with the `deep-link` feature).
- `crates/agent-gui/src-tauri/tauri.conf.json` — registers the `boxai-desktop` scheme.
- `crates/agent-gui/src-tauri/capabilities/default.json` — grants `deep-link:default`.
- `crates/agent-gui/src-tauri/src/lib.rs` — single-instance first, deep-link plugin,
  `on_open_url` forwards callback URLs to the frontend via `emit("boxai://auth-callback")`
  and focuses the main window. The paste fallback in `BoxAILogin` remains.

### Dynamic models + scheduled token refresh

- `crates/agent-gui/src/lib/boxaiAuth/models.ts` — live model catalog cache
  (`boxai_desktop_model_catalog_v1`); curated lists are now the fallback.
- `crates/agent-gui/src/lib/boxaiAuth/client.ts` — `fetchGatewayModels` pulls
  `<server>/v1/models` with the JWT.
- `crates/agent-gui/src/App.tsx` — hydrates the catalog from cache then live fetch;
  schedules a pre-expiry access-token refresh (retries transient failures, signs out
  on an unusable expired token); sign-out clears the cached catalog.

### Gateway boxAI-JWT auth fallback

- `crates/agent-gateway/internal/auth/boxai.go` — optional validator: when
  `BOXAI_SERVER_URL` / `-boxai-server-url` is set, JWT-shaped tokens are verified
  against `<server>/api/v1/auth/me` (cached ~1 min positive / 10 s negative).
- `crates/agent-gateway/internal/auth/http_middleware.go` — `ValidateToken` checks the
  static shared token first, then falls back to the boxAI validator; this covers HTTP,
  browser WebSocket payloads, and gRPC metadata.
- `crates/agent-gateway/internal/server/grpc.go` — the agent `Authenticate` RPC uses
  `auth.ValidateToken`.
- `crates/agent-gateway/internal/config/config.go` + `cmd/gateway/main.go` — config
  field, flag, and startup wiring.
- `crates/agent-gateway/test/auth/boxai_test.go` — fallback/caching tests.

### Monorepo release scheme (desktop-v* tags)

- `scripts/release/release-version.mjs` — accepts `desktop-vX.Y.Z` tags (the full tag
  stays the release tag; the app version strips the prefix).
- `crates/agent-gui/src-tauri/src/commands/app/update.rs` — the in-app updater parses
  `desktop-v*` tags and ignores main-site `v*-box.N` releases; the root workflow lives
  at `.github/workflows/desktop-release.yml` (repo root, paths prefixed with `desktop/`).

### Pending

- Rust compile verification of the deep-link changes (`cargo check` needs `protoc`,
  which is not installed locally; CI installs it via brew/choco/apt).
- Runtime/provider trim (drop unused Gemini/codex-native/custom surfaces where safe).

## Re-syncing upstream

Upstream changes are pulled manually (this is not a submodule). To compare against a
newer upstream commit, clone BoxLiveAgent separately and diff into this tree, keeping
the BoxAI product deltas (branding, auth, single-provider, runtime trim).
