# BoxAI Web Platform

Canonical product architecture for **you-box.com**: **customer shell on apex React**, admin console on Vue, shared Go gateway.

> **Architecture:** See [CUSTOMER_SHELL_UNIFICATION.md](./CUSTOMER_SHELL_UNIFICATION.md). One customer domain/session on apex; console is admin-first. **Web SSO has been removed.**

## Hosts

| Host | Serves | Origin of content |
|------|--------|-------------------|
| `you-box.com` | Marketing, Studio, Creator, **customer account/auth/checkout** | React static (`web/dist` → `/var/www/you-box.com`); edge allowlists browser APIs and proxies `/v1/*`, `/health` |
| `www.you-box.com` | Permanent redirect | → `https://you-box.com` |
| `console.you-box.com` | **Admin** (+ WeChat MP payment exception paths); Desktop browser login (legacy URL) | Go binary embeds Vue (`frontend/` build) |
| `api.you-box.com` | Public model API + token exchange | Same Go process; **edge-filtered** paths only |

One Docker image (`ghcr.io/fran0220/boxai:<pin>`) runs the Go server (Vue embed + API). React is **never** embedded in that binary.

## Auth

Each UI host owns an independent `HttpOnly; Secure; SameSite=Lax; Path=/`
`__Host-boxai_session` cookie. The cookie has no `Domain`, cannot be read by
JavaScript, and is never accepted on `api.you-box.com`. Browser code keeps only a
short-lived, audience-scoped access JWT **in memory**; refresh tokens and JWT pairs
must not be persisted in localStorage.

Browser session API (same-origin UI hosts only):

| Endpoint | Purpose |
|----------|---------|
| `POST /api/v1/auth/session` | Bootstrap: validate the host cookie and mint a short-lived access JWT for that host/audience |
| `POST /api/v1/auth/session/adopt` | One-time rollout import of a legacy refresh token into a host cookie |
| `POST /api/v1/auth/session/logout` | Revoke the browser session and clear its cookie |
| `POST /api/v1/auth/registration/prepare` | Apex (and console): opaque registration transaction + email code |
| `POST /api/v1/auth/registration/complete` | Complete registration and establish a **host-bound** browser session |
| `POST /api/v1/auth/login` · `/login/2fa` | Password login (+ 2FA); browser session when `X-BoxAI-Browser-Session: 1` |
| `GET /api/v1/auth/me` | Resolve the current user with the in-memory access JWT |
| `POST /api/v1/auth/revoke-all-sessions` | Revoke every session for the user |

Browser-session requests carry `X-BoxAI-CSRF: 1`, an exact same-origin `Origin`,
and (when supplied by the browser) a non-cross-site `Sec-Fetch-Site`. Never infer trust from `X-Forwarded-Host`;
the edge preserves the exact request `Host` and strips forwarded-host input.

Password-reset email links place the email and one-time reset token in the URL
fragment. The Vue reset page captures and removes it before making requests;
legacy query-string links remain readable only for migration compatibility.
During email registration, the browser persists only the opaque transaction ID,
email address, safe return path, and resend countdown in `sessionStorage`.
Plaintext passwords and Turnstile responses never leave the registration page;
Redis retains only the bcrypt password hash and registration business fields.

**Apex is the customer identity UI.** Password login/register/forgot/reset and the
account center live on `you-box.com`. There is **no cross-origin Web SSO** and no
parent-domain cookie (`Domain=.you-box.com` is forbidden).

**Console is admin-first.** Non-admin navigations to customer UI hard-redirect to
apex (`VITE_CUSTOMER_SHELL_REDIRECT`, default on for `console.you-box.com`). Admin
login remains on console. **Exception:** WeChat in-WeChat MP payment may still use
console `/purchase` + `/payment/*` (registered callback domain); users re-login on
console for that path only.

Flags: `BOXAI_BROWSER_SESSION=true`; `BOXAI_LEGACY_BROWSER_ADOPTION` only if legacy
refresh tokens remain to adopt. **`BOXAI_WEB_SSO` is retired and ignored.**

**Desktop login** uses a separate PKCE pair:

- `POST /api/v1/auth/boxai/desktop/authorize` · `POST /api/v1/auth/boxai/desktop/token`
- Preferred browser page: `you-box.com/desktop-auth` (console `/desktop-auth` still works)

## Apex pages

Trilingual (zh / en / vi) React SPA. `/studio` is the single Studio (desktop app +
browser WebUI) product + download page (legacy `/desktop` and `/download` redirect
to it). `/pricing` shows static plan cards; purchase CTAs deep-link into the
console via Web SSO.

## Creator

Creator is an image/video generation workbench on the apex React app
(`/create/image` — default, `/create/video`, `/create/assets`).

**Image workbench** embeds a BoxAI-adapted build of
[gpt_image_playground](https://github.com/CookSleep/gpt_image_playground) (MIT)
under `web/src/image-playground/`:

- Text-to-image, multi-reference + mask edit, streaming, gallery, favorites, Agent (Responses API)
- Auth: live session JWT injected only for the BoxAI gateway origin (never persisted as API key; multi-provider locked)
- History: playground IndexedDB (`gpt-image-playground`) plus mirror into Creator `assets-db` for `/create/assets`
- Attribution / license: settings about panel + `LICENSE.upstream`

Video generation stays on the simpler Creator page. Desktop Studio agent chat is separate.

Calls:

```http
Authorization: Bearer <access JWT>
POST /v1/images/generations
POST /v1/images/edits
POST /v1/responses
POST /v1/videos/generations
GET  /v1/videos/:id
POST /api/v1/boxai/creator/ensure-key
```

JWT is translated to the user’s API key by `BOXAI_DESKTOP_JWT_GATEWAY` (shared with Desktop). Prefer an active key named `boxai-creator` that has a group binding.

## Edge

- Nginx: `deploy/nginx-you-box.com.conf`
- Caddy: `deploy/Caddyfile.you-box.com`

`api.you-box.com` allows only:

- `/v1/*`
- `/api/v1/auth/boxai/desktop/token`
- `/api/v1/auth/refresh`
- `/api/v1/settings/public`
- `/health`

The apex allowlist is deny-by-default for `/api/*` with **admin/setup hard-denied**,
then explicit customer paths: session bootstrap, credential login/register,
customer keys/usage/user/payment/subscriptions/redeem, and Creator ensure-key.
Console continues to proxy the complete backend surface.

## Code map

| Path | Role |
|------|------|
| `web/` | React product SPA |
| `frontend/` | Vue console (embedded) |
| `backend/internal/handler/boxai_*.go` | SSO, desktop auth, Creator key, JWT bridge |
| `backend/internal/server/routes/boxai_code_store.go` | Redis store adapter |
| `desktop/` | Tauri client |
| `deploy/scripts/` | Static deploy, nginx apply, topology verify |

## Ops

```bash
./deploy/scripts/deploy-web-static.sh
./deploy/scripts/apply-nginx-topology.sh
./deploy/scripts/verify-topology.sh
```

Local development: [LOCAL_DEV.md](./LOCAL_DEV.md). Production ops: [PRODUCTION.md](./PRODUCTION.md). Desktop: [OFFICE_MODULE.md](./OFFICE_MODULE.md).
