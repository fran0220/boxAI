# BoxAI local development (dual frontend)

Run **three processes** for full product surface: backend, Vue console, React web.

## Ports

| Process | Port | Directory | Command |
|---------|------|-----------|---------|
| Backend | `8080` | `backend/` | `go run ./cmd/server` |
| Console (Vue) | `3000` | `frontend/` | `pnpm dev:local-api` |
| Marketing + Creator (React) | `5173` | `web/` | `pnpm dev` |
| Desktop | n/a | `desktop/` | Tauri build (see `docs/OFFICE_MODULE.md`) |

## One-shot helper

```bash
# From repo root (requires tmux optional — or open 3 terminals)
# Terminal 1
cd backend && go run ./cmd/server

# Terminal 2
cd frontend && pnpm install && pnpm dev:local-api

# Terminal 3
cd web && pnpm install && cp -n .env.example .env.local 2>/dev/null; pnpm dev
```

Open:

- Marketing / Creator: <http://localhost:5173>
- Console / admin: <http://localhost:3000>
- API health: <http://localhost:8080/health>

## Environment

### Backend

Use existing `deploy/config.example.yaml` / env vars. SSO defaults include localhost callbacks:

- `http://localhost:5173/sso/callback`
- `http://localhost:3000/boxai/sso/callback`

Flags: `BOXAI_WEB_SSO` (default on), `BOXAI_DESKTOP_JWT_GATEWAY` (default on).

### React `web/`

See `web/.env.example`. Important:

| Variable | Local | Production build |
|----------|-------|------------------|
| `VITE_CONSOLE_ORIGIN` | `http://localhost:3000` | omit → `https://console.you-box.com` |
| `VITE_API_BASE` | empty (proxy) | empty (same-origin nginx proxy) |
| `VITE_DEV_PROXY_TARGET` | `http://localhost:8080` | n/a |

### Vue `frontend/`

`pnpm dev:local-api` proxies API to `VITE_DEV_PROXY_TARGET` or `http://localhost:8080`.

## SSO smoke (local)

1. Log in on <http://localhost:5173/login>
2. Open <http://localhost:5173/sso?target=console> → should hand off to console with session
3. Creator: <http://localhost:5173/create/chat> (requires login + backend groups/models)

## Desktop smoke

1. Build desktop app (`desktop/` README)
2. Server URL: `http://localhost:8080`
3. Browser login uses Vue `/desktop-auth` on the configured server host

## Production topology

See [WEB_PLATFORM.md](./WEB_PLATFORM.md) and [PRODUCTION.md](./PRODUCTION.md).
