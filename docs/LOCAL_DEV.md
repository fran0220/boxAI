# Local development

Run three processes for the full web product. Desktop is optional (fourth).

## Processes

| Process | Port | Directory | Command |
|---------|------|-----------|---------|
| Backend | `8080` | `backend/` | `go run ./cmd/server` |
| Console (Vue) | `3000` | `frontend/` | `pnpm install && pnpm dev:local-api` |
| Customer web (React) | `5173` | `web/` | `pnpm install && pnpm dev` |
| Desktop | — | `desktop/` | See [OFFICE_MODULE.md](./OFFICE_MODULE.md) |

| Open | URL |
|------|-----|
| Customer shell (marketing / Creator / account) | http://localhost:5173 |
| Admin console | http://localhost:3000 |
| Health | http://localhost:8080/health |

Production mapping: `5173` → `you-box.com`, `3000` → `console.you-box.com`.

## Prerequisites

- Go (see `backend/go.mod`)
- pnpm 9+
- PostgreSQL + Redis (local compose or native)

## Environment

### Backend

| Env | Default | Meaning |
|-----|---------|---------|
| `BOXAI_BROWSER_SESSION` | on | Host-only browser cookie and bootstrap/logout endpoints |
| `BOXAI_LEGACY_BROWSER_ADOPTION` | **off** in compose | One-time legacy localStorage refresh-token adoption. Go treats **unset** as on — set `false` explicitly. |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | `15` | In-memory browser access JWT lifetime |
| `BOXAI_DESKTOP_JWT_GATEWAY` | on | JWT→API key on `/v1/*` |
| `BOXAI_AUTH_TX` | off | Experimental auth-tx continue API (not required for normal login) |
| `BOXAI_CONSOLE_ADMIN_SESSION_ONLY` | off | If on, non-admin cannot mint console cookies (breaks WeChat MP console re-login) |

Example:

```bash
export JWT_ACCESS_TOKEN_EXPIRE_MINUTES=15
export BOXAI_LEGACY_BROWSER_ADOPTION=false
```

Vite proxies preserve each UI origin’s session. Expect `__Host-boxai_session` in HTTPS production; local HTTP may use development cookie handling. Access JWTs are memory-only. Send `X-BoxAI-CSRF: 1` plus exact `Origin` on browser-session requests.

**Web SSO is removed** — there is no `BOXAI_WEB_SSO` flow between 5173 and 3000.

### React (`web/`)

Copy `web/.env.example` → `web/.env.local` if needed.

| Variable | Local value |
|----------|-------------|
| `VITE_DEV_PROXY_TARGET` | `http://localhost:8080` |
| `VITE_CONSOLE_ORIGIN` | `http://localhost:3000` (WeChat payment exception / rare deep links) |
| `VITE_API_BASE` | empty (same-origin via Vite proxy) |

### Vue (`frontend/`)

`pnpm dev:local-api` proxies `/api` to the backend on `:8080`.  
Non-admin customer routes redirect to apex when `VITE_CUSTOMER_SHELL_REDIRECT=1` (or production console host). Local default is usually **off** so both ports can be exercised without hard redirects.

## Checks

```bash
# Backend
cd backend && go test -tags=unit ./internal/handler/ -run 'Browser|Creator|Registration|PublicStatus'

# Console
cd frontend && pnpm typecheck

# Customer web
cd web && pnpm typecheck && pnpm test:run
```

## Smoke

1. Log in at http://localhost:5173/login (password and/or OAuth if providers configured).  
2. Open Creator http://localhost:5173/create/image  
3. Account http://localhost:5173/account/keys  
4. Admin: http://localhost:3000/admin (admin user)  
5. Desktop: prefer browser login via http://localhost:5173/desktop-auth (console `/desktop-auth` still works for old clients)

Architecture: [WEB_PLATFORM.md](./WEB_PLATFORM.md) · Agent next steps: [agents/next-actions.md](./agents/next-actions.md).
