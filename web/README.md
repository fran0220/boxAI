# BoxAI Web (`you-box.com`)

React marketing + Creator SPA. **Not** embedded in the Go binary — ship `dist/` via Caddy/Nginx.

See [`docs/WEB_PLATFORM.md`](../docs/WEB_PLATFORM.md).

```bash
pnpm install
pnpm dev          # :5173, proxies /api and /v1 → localhost:8080
pnpm build        # → dist/
pnpm typecheck
pnpm test:run
```

Env:

| Variable | Default | Meaning |
|----------|---------|---------|
| `VITE_API_BASE` | empty | Same-origin API prefix |
| `VITE_CONSOLE_ORIGIN` | auto | Console base URL for SSO / billing |
| `VITE_DEV_PROXY_TARGET` | `http://localhost:8080` | Dev proxy backend |
| `VITE_DESKTOP_RELEASE_REPO` | `fran0220/boxAI` | Desktop release assets |
