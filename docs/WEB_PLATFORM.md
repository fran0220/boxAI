# BoxAI Web Platform

Canonical product architecture for **you-box.com**: **customer shell on apex React**, admin console on Vue, shared Go gateway.

> **Migration:** See [CUSTOMER_SHELL_UNIFICATION.md](./CUSTOMER_SHELL_UNIFICATION.md). Target: one customer domain/session; console is admin-only; Web SSO is a transitional bridge only.

## Hosts

| Host | Serves | Origin of content |
|------|--------|-------------------|
| `you-box.com` | Marketing, Studio, Creator, **customer account/auth/checkout**, (legacy Web SSO pages) | React static (`web/dist` → `/var/www/you-box.com`); edge allowlists browser APIs and proxies `/v1/*`, `/health` |
| `www.you-box.com` | Permanent redirect | → `https://you-box.com` |
| `console.you-box.com` | **Admin** (+ transitional customer pages / SSO until cutover); Desktop browser login (legacy URL) | Go binary embeds Vue (`frontend/` build) |
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
| `POST /api/v1/auth/registration/prepare` | Console-only: hash the password server-side, create a 15-minute opaque registration transaction, and send the first email code |
| `POST /api/v1/auth/registration/complete` | Console-only: verify the email code, consume the transaction, create the account, and establish the console browser session |
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

**Apex is the customer identity UI (target).** Password login/register/forgot/reset
and account center live on `you-box.com`. Console remains the admin host and still
hosts full credential forms during transition. Web SSO remains available as a
rollback bridge until customer cutover is complete.

**Web SSO (PKCE)** (transitional) links sessions between apex and console:

| Step | Endpoint |
|------|----------|
| Mint code (authenticated) | `POST /api/v1/auth/boxai/sso/authorize` |
| Exchange code (public) | `POST /api/v1/auth/boxai/sso/token` |

Pages:

- Apex cold → console: apex `/login` · `/signup` → console `/boxai/sso/authorize`
  (console credentials) → apex `/sso/callback` → token exchange on apex.
- Apex warm → console cold: Header/links open console `/boxai/sso/start` →
  (console cold) apex `/sso/authorize` mints with apex JWT → console
  `/boxai/sso/callback` → token exchange on console.
- Console warm: console `/boxai/sso/start` mints locally → console callback.

Either UI origin can mint a code with its in-memory access JWT. Only the console
hosts credential forms. The PKCE verifier stays in memory/session-scoped state;
the one-time code does not transfer a cookie between hosts.

Rules:

- Code is one-time, Redis-backed, short TTL; delivered in URL **fragment**.
- `redirect_uri` is required and allowlisted.
- Production callbacks are built in. Local callbacks require the explicit
  `BOXAI_WEB_SSO_REDIRECT_URIS` opt-in; restart to apply.
- Flags: `BOXAI_BROWSER_SESSION=true`, `BOXAI_LEGACY_BROWSER_ADOPTION=true`
  during migration, and `BOXAI_WEB_SSO=true`.

### Rollout and rollback

1. Deploy backend/session schema and edge allowlist; set access lifetime to 15
   minutes and enable browser sessions plus legacy adoption.
2. Deploy Vue image and React static build. Each host adopts its old refresh token
   once, deletes legacy storage, then bootstraps from its own cookie.
3. After adoption telemetry has drained, set `BOXAI_LEGACY_BROWSER_ADOPTION=false`.
4. Rollback UI first while adoption remains enabled. For an emergency backend
   rollback, disable `BOXAI_BROWSER_SESSION`; users may need to sign in again.
   Never re-expose login/register/admin APIs on the apex or session APIs on API host.

**Desktop login** uses a separate PKCE pair:

- `POST /api/v1/auth/boxai/desktop/authorize` · `POST /api/v1/auth/boxai/desktop/token`
- Browser page: `console.you-box.com/desktop-auth` → `boxai-desktop://` callback

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
- `/api/v1/auth/boxai/sso/token`
- `/api/v1/auth/boxai/desktop/token`
- `/api/v1/auth/refresh`
- `/api/v1/settings/public`
- `/health`

The apex allowlist is deny-by-default for `/api/*` with **admin/setup hard-denied**,
then explicit customer paths: session bootstrap, credential login/register,
customer keys/usage/user/payment/subscriptions/redeem, Web SSO (transitional), and
Creator ensure-key. Console continues to proxy the complete backend surface.

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
