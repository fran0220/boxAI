# BoxAI Desktop

Tauri desktop client (React WebView + Rust) with optional self-hosted remote gateway.

## Role in the product

| Component | URL / location |
|-----------|----------------|
| Download & marketing | https://you-box.com/download · https://you-box.com/studio (`web/`) |
| Browser login handshake | https://console.you-box.com/desktop-auth (Vue embed) |
| Model / chat API | https://api.you-box.com/v1 (or console host) |
| Auth bridge | `BOXAI_DESKTOP_JWT_GATEWAY` on `/v1/*` (same bridge as Creator) |

Desktop is **local-first** for agent/tools. Browser Creator (`you-box.com/create`) is for gateway try-and-create, not a full local agent.

## Code

| Path | Role |
|------|------|
| `desktop/` | Vendored app (provenance: `desktop/UPSTREAM.md`) |
| `desktop/crates/agent-gui/` | Tauri + React UI |
| `desktop/crates/agent-gateway/` | Optional remote Go gateway |
| `backend/internal/handler/boxai_desktop_*.go` | PKCE authorize/token + JWT gateway bridge |

## Goals

1. User installs Desktop and signs in with a **BoxAI account** (system browser + PKCE).
2. Locked providers: `BoxAI (Claude)` and `BoxAI (OpenAI)` only.
3. Inference goes through BoxAI `/v1/*` with user JWT (bridged to API key).
4. Model list from `GET /v1/models` with local cache.
5. Token refresh via `POST /api/v1/auth/refresh`.
6. Server URL is user-configured (production: `https://api.you-box.com` or `https://console.you-box.com`).

## Non-goals

- Full agent workspace inside the browser (that is Desktop).
- Password entry inside the Tauri webview (always system browser).

## Login flow

1. User enters server base URL and clicks Sign in.
2. Desktop opens `https://<server>/desktop-auth?state&code_challenge&redirect_uri=boxai-desktop://…`.
3. After web login, console mints a one-time code and redirects to the desktop scheme.
4. Desktop exchanges code at `/api/v1/auth/boxai/desktop/token`.
5. Subsequent chat uses Bearer JWT on `/v1/messages` or `/v1/chat/completions`.

## Backend API

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/v1/auth/boxai/desktop/authorize` | User JWT |
| POST | `/api/v1/auth/boxai/desktop/token` | Public (PKCE) |
| ANY | `/v1/*` | Bearer JWT or `sk-*` |

## Release

Desktop installers ship on GitHub `desktop-v*` tags (workflow: `.github/workflows/desktop-release.yml`). Apex download UI: `web/` `/studio` (legacy `/download` redirects).

Web platform: [WEB_PLATFORM.md](./WEB_PLATFORM.md). Local: [LOCAL_DEV.md](./LOCAL_DEV.md).
