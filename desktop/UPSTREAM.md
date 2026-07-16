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

### Pending (requires a Rust/Tauri build to verify)

- Deep-link auto-return: add `tauri-plugin-deep-link` (+ `tauri-plugin-single-instance`
  on Windows/Linux), register the `boxai-desktop` scheme in `tauri.conf.json` bundle
  config + `capabilities`, and in `lib.rs` `setup` call `app.deep_link().on_open_url(..)`
  to `emit("boxai://auth-callback", urls)` to the frontend. Until then, users complete
  sign-in via the paste fallback in `BoxAILogin`.
- Vendored gateway validates the JWT via boxAI `/api/v1/auth/me`.
- Runtime/provider trim (drop unused Gemini/codex-native/custom surfaces where safe).

## Re-syncing upstream

Upstream changes are pulled manually (this is not a submodule). To compare against a
newer upstream commit, clone BoxLiveAgent separately and diff into this tree, keeping
the BoxAI product deltas (branding, auth, single-provider, runtime trim).
