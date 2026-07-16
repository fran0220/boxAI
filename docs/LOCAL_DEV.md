# Local development

Run three processes for the full web product. Desktop is optional (fourth).

## Processes

| Process | Port | Directory | Command |
|---------|------|-----------|---------|
| Backend | `8080` | `backend/` | `go run ./cmd/server` |
| Console (Vue) | `3000` | `frontend/` | `pnpm install && pnpm dev:local-api` |
| Product web (React) | `5173` | `web/` | `pnpm install && pnpm dev` |
| Desktop | — | `desktop/` | See [OFFICE_MODULE.md](./OFFICE_MODULE.md) |

| Open | URL |
|------|-----|
| Marketing / Creator | http://localhost:5173 |
| User / admin console | http://localhost:3000 |
| Health | http://localhost:8080/health |

Production mapping: `5173` → `you-box.com`, `3000` → `console.you-box.com`.

## Prerequisites

- Go (see `backend/go.mod`)
- pnpm 9+
- PostgreSQL + Redis (local compose or native)

## Environment

### Backend

Local SSO callbacks are an explicit backend opt-in (comma-separated):

- `http://localhost:5173/sso/callback`
- `http://localhost:3000/boxai/sso/callback`

| Env | Default | Meaning |
|-----|---------|---------|
| `BOXAI_WEB_SSO` | on | Web SSO endpoints |
| `BOXAI_BROWSER_SESSION` | on | Host-only browser cookie and bootstrap/logout endpoints |
| `BOXAI_LEGACY_BROWSER_ADOPTION` | on during rollout | One-time legacy localStorage refresh-token adoption |
| `BOXAI_WEB_SSO_REDIRECT_URIS` | empty | Set to `http://localhost:5173/sso/callback,http://localhost:3000/boxai/sso/callback` for local SSO |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | `15` | In-memory browser access JWT lifetime |
| `BOXAI_DESKTOP_JWT_GATEWAY` | on | JWT→API key on `/v1/*` |

Example before starting the backend:

```bash
export BOXAI_BROWSER_SESSION=true BOXAI_LEGACY_BROWSER_ADOPTION=true BOXAI_WEB_SSO=true
export BOXAI_WEB_SSO_REDIRECT_URIS='http://localhost:5173/sso/callback,http://localhost:3000/boxai/sso/callback'
export JWT_ACCESS_TOKEN_EXPIRE_MINUTES=15
```

The Vite proxies preserve each UI origin's session. Expect
`__Host-boxai_session` in HTTPS production; local HTTP development may use the
backend's development cookie handling. Access JWTs are memory-only. Send the
`X-BoxAI-CSRF: 1` plus the exact `Origin` on browser-session requests.

### React (`web/`)

Copy `web/.env.example` → `web/.env.local` if needed.

| Variable | Local value |
|----------|-------------|
| `VITE_DEV_PROXY_TARGET` | `http://localhost:8080` |
| `VITE_CONSOLE_ORIGIN` | `http://localhost:3000` |
| `VITE_API_BASE` | empty (same-origin via Vite proxy) |

### Vue (`frontend/`)

`pnpm dev:local-api` proxies `/api` to the backend on `:8080`.

## Checks

```bash
# Backend
cd backend && go test -tags=unit ./internal/handler/ -run 'WebSSO|Creator|ResolveUserGateway'

# Console
cd frontend && pnpm typecheck

# Product web
cd web && pnpm typecheck && pnpm test:run
```

## Smoke

1. Log in at http://localhost:5173/login  
2. Open Creator http://localhost:5173/create/image  
3. Console handoff: http://localhost:5173/sso?target=console  
4. Desktop: set server to `http://localhost:8080`, browser login via console `/desktop-auth`

Architecture: [WEB_PLATFORM.md](./WEB_PLATFORM.md).
