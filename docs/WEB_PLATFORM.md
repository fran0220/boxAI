# BoxAI Web Platform

Canonical product architecture for **you-box.com**: dual frontend, shared gateway, PKCE SSO.

## Hosts

| Host | Serves | Origin of content |
|------|--------|-------------------|
| `you-box.com` | Marketing, Studio, download, Creator (`/create/*`), login/signup, Web SSO | React static (`web/dist` → `/var/www/you-box.com`); nginx proxies `/api/*`, `/v1/*`, `/health` to Go |
| `www.you-box.com` | Permanent redirect | → `https://you-box.com` |
| `console.you-box.com` | User dashboard, admin, billing, keys, Desktop browser login | Go binary embeds Vue (`frontend/` build) |
| `api.you-box.com` | Public model API + token exchange | Same Go process; **edge-filtered** paths only |

One Docker image (`ghcr.io/fran0220/boxai:<pin>`) runs the Go server (Vue embed + API). React is **never** embedded in that binary.

## Auth

Origins do **not** share cookies. Each origin keeps its own `localStorage` JWT pair.

**Web SSO (PKCE)** links sessions between apex and console:

| Step | Endpoint |
|------|----------|
| Mint code (authenticated) | `POST /api/v1/auth/boxai/sso/authorize` |
| Exchange code (public) | `POST /api/v1/auth/boxai/sso/token` |

- Code is one-time, Redis-backed, short TTL; delivered in URL **fragment**.
- `redirect_uri` is required and allowlisted.
- Defaults include production callbacks and localhost (`:5173` / `:3000`).
- Env: `BOXAI_WEB_SSO` (default on), `BOXAI_WEB_SSO_REDIRECT_URIS` (extra URIs; **restart** to apply).

**Desktop login** uses a separate PKCE pair:

- `POST /api/v1/auth/boxai/desktop/authorize` · `POST /api/v1/auth/boxai/desktop/token`
- Browser page: `console.you-box.com/desktop-auth` → `boxai-desktop://` callback

## Creator

Creator lives on the apex React app (`/create/chat`, `/create/image`, `/create/video`, `/create/assets`).

Calls:

```http
Authorization: Bearer <access JWT>
POST /v1/chat/completions
POST /v1/images/generations
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
