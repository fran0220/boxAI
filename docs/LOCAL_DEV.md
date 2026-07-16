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

SSO allowlist includes localhost callbacks by default:

- `http://localhost:5173/sso/callback`
- `http://localhost:3000/boxai/sso/callback`

| Env | Default | Meaning |
|-----|---------|---------|
| `BOXAI_WEB_SSO` | on | Web SSO endpoints |
| `BOXAI_DESKTOP_JWT_GATEWAY` | on | JWT→API key on `/v1/*` |

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
