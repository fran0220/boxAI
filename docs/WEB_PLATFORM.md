# BoxAI Web Platform (you-box.com)

Production dual-frontend topology for marketing, Creator, shared PKCE SSO, and the existing Vue console.

## Domain topology

| Host | Serves |
|------|--------|
| `you-box.com` | React SPA (`web/` dist) — marketing, Studio, download, Creator (`/create/*`), login/signup, SSO |
| `www.you-box.com` | `301` → apex `you-box.com` |
| `console.you-box.com` | Go binary + embedded Vue console (minimal BoxAI SSO views at `/boxai/sso/*`) |
| `api.you-box.com` | Same backend process; **edge-filtered** public API surface (see below) |

**Do not embed the React app in the Go binary.** Ship `web/dist` as static files (Caddy `root` / `file_server`). Edge reverse-proxies `/api/*` and `/v1` from `you-box.com` to the backend so Creator can call the gateway same-origin.

## Auth model

Cookie `Domain=.you-box.com` SSO is **out of scope** (would rewrite Vue session storage).

Instead: **PKCE one-time-code Web SSO** (generalizes desktop browser login).

### Warm flow (console already has a session, or self-SSO)

1. Origin A (authenticated) generates PKCE `code_verifier` / `code_challenge` (S256) and a random `state`, stores verifier+state in **sessionStorage** on A.
2. Origin A calls:
   ```
   POST /api/v1/auth/boxai/sso/authorize
   Authorization: Bearer <jwt>
   { "code_challenge": "...", "redirect_uri": "https://…/callback" }
   ```
3. Origin A redirects the browser to `redirect_uri` with the code in the **URL fragment** (preferred):
   ```
   https://console.you-box.com/boxai/sso/callback#code=…&state=…
   ```
4. Origin B reads the fragment, requires stored state match (fail closed), exchanges:
   ```
   POST /api/v1/auth/boxai/sso/token
   { "code": "…", "code_verifier": "…", "redirect_uri": "…" }
   ```
   (`redirect_uri` is **required** and must match the value bound at authorize time.)
5. Origin B stores the returned JWT in **its own** `localStorage` (`auth_token` / `refresh_token`).

### Cold flow (console unauthenticated → marketing identity host)

1. User opens `console.you-box.com/boxai/sso/start?return_to=/billing`.
2. Console mints PKCE, stores verifier/state in **console** sessionStorage.
3. If console has no JWT, browser goes to marketing:
   ```
   https://you-box.com/sso/authorize?code_challenge=…&redirect_uri=https://console…/callback&state=…
   ```
4. If marketing is unauthenticated, login with `from` = full authorize URL; after login, authorize resumes.
5. Marketing (authenticated) calls `sso/authorize`, redirects to console callback with `#code&state`.
6. Console exchanges with its verifier (step 4 of warm flow).

### Marketing → Console shortcut

`/sso?target=console` on marketing simply redirects to `console…/boxai/sso/start` so console owns PKCE (no dead local mint).

Desktop browser login remains separate (`/auth/boxai/desktop/*` + `boxai-desktop://` scheme).

### Endpoints

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| `POST` | `/api/v1/auth/boxai/sso/authorize` | JWT | Rate-limited 30/min fail-close; Redis one-time code TTL 2m |
| `POST` | `/api/v1/auth/boxai/sso/token` | Public | Rate-limited 30/min; `GETDEL` single-use; Redis transport errors → 500 |
| `POST` | `/api/v1/boxai/creator/ensure-key` | JWT | Idempotent create metadata for key named `boxai-creator` (**no plaintext key in response**) |

### Redirect allowlist

Defaults (plus trailing-slash normalization):

- `https://you-box.com/sso/callback`
- `https://console.you-box.com/boxai/sso/callback`
- Local dev: `http://localhost:5173/sso/callback`, `http://localhost:3000/boxai/sso/callback` (and `127.0.0.1`)

Extend with env:

```bash
BOXAI_WEB_SSO_REDIRECT_URIS=https://staging.you-box.com/sso/callback,https://…
```

**Restart required:** allowlist is loaded once per process (`sync.Once`). Changing `BOXAI_WEB_SSO_REDIRECT_URIS` or defaults requires a backend restart.

### Flags

| Env | Default | Meaning |
|-----|---------|---------|
| `BOXAI_WEB_SSO` | on | Set `0`/`false`/`off` to disable SSO endpoints |
| `BOXAI_WEB_SSO_REDIRECT_URIS` | empty | Extra comma-separated redirect URIs (**restart to apply**) |
| `BOXAI_DESKTOP_JWT_GATEWAY` | on | JWT→API-key bridge on `/v1/*` (shared by Desktop + Creator) |

## Creator gateway access

Creator pages call `/v1/*` same-origin with:

```
Authorization: Bearer <access_token JWT>
```

`DesktopJWTGatewayAuth` validates the JWT, resolves an account API key, rewrites `Authorization` to that key, then defers to standard API-key auth.

**Key preference (JWT bridge):**

1. Active key named `boxai-creator` **with GroupID**
2. Else first other active key with GroupID
3. Else any active key

`ensure-key` binds the first available group when creating `boxai-creator` so Creator does not steal Desktop traffic onto an ungrouped key. Response omits plaintext `key` (XSS-safe; bridge is JWT-only).

Video create path: `POST /v1/videos/generations` (status: `GET /v1/videos/:id`).

## Edge / security

`deploy/Caddyfile.you-box.com` applies shared headers on all hosts:

- `Strict-Transport-Security` (HSTS)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY` (SSO authorize is zero-click — block framing)
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` (camera/mic/geo off)

### `api.you-box.com` intentional surface

| Path | Why |
|------|-----|
| `/v1/*` | Model gateway |
| `/api/v1/auth/boxai/sso/token` | Public SSO exchange |
| `/api/v1/auth/boxai/desktop/token` | Public desktop exchange |
| `/api/v1/auth/refresh` | Token refresh for native clients |
| `/api/v1/settings/public` | Public site settings |
| `/health` | Health checks |

Login/register/admin and `sso/authorize` stay on console/apex. Do **not** expose full `/api/v1/auth/*` on the API host.

## Packages / apps

| Path | Role |
|------|------|
| `web/` | React (Vite + TS + Tailwind) marketing + Creator SPA |
| `web/src/lib/` | Shared auth + `/api/v1` + `/v1` client (no separate package) |
| `frontend/` | Vue console — SSO start/callback under `/boxai/sso/*` |
| `backend/internal/handler/boxai_web_sso.go` | SSO authorize/token |
| `backend/internal/handler/boxai_creator_key.go` | ensure-key |
| `backend/internal/handler/boxai_desktop_gateway_auth.go` | JWT bridge + creator key preference |
| `deploy/Caddyfile.you-box.com` | 3-host Caddy example |

## Local development

### Backend

```bash
cd backend && go run ./cmd/server
# listens :8080 by default
```

### Vue console

```bash
cd frontend && pnpm install && pnpm dev:local-api
# default :3000, proxies /api to localhost:8080
```

### React web

```bash
cd web && pnpm install && pnpm dev
# default :5173, proxies /api/v1 and /v1 to localhost:8080
# VITE_API_BASE empty = same-origin
# VITE_CONSOLE_ORIGIN=http://localhost:3000
```

### SSO local smoke

**Warm / marketing → console:**

1. Log in on `http://localhost:5173/login`.
2. Open `/sso?target=console` (or Account → Console).
3. Console `/boxai/sso/start` owns PKCE; if cold, redirects to marketing authorize.
4. Callback lands on `http://localhost:3000/boxai/sso/callback#code=…`.
5. Vue exchanges token and navigates to `return_to` (safe relative path only).

## Deploy notes

See `deploy/Caddyfile.you-box.com` and `docs/PRODUCTION.md`.

- Build React: `cd web && pnpm build` → publish `web/dist` to the host serving `you-box.com`.
- Console remains the Go embed path on `console.you-box.com`.
- Production builds of `web/` ship **without** sourcemaps.

## Out of scope

- Full OAuth provider UI in React (use console OAuth + SSO back)
- Cookie-domain SSO
- Migrating Vue console pages into React
- Infinite canvas / audio playground
