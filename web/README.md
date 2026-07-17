# BoxAI Web (`you-box.com`)

React **customer shell** SPA: marketing, Creator, auth, account center, checkout, status.  
**Not** embedded in the Go binary — ship `dist/` via nginx/Caddy.  
Admin UI lives on `console.you-box.com` (Vue). There is **no Web SSO**.

| Production | Local |
|------------|--------|
| https://you-box.com | http://localhost:5173 |
| WeChat MP / rare console deep-link → https://console.you-box.com | `VITE_CONSOLE_ORIGIN=http://localhost:3000` |

Architecture: [`docs/WEB_PLATFORM.md`](../docs/WEB_PLATFORM.md) · three-process local: [`docs/LOCAL_DEV.md`](../docs/LOCAL_DEV.md) · backlog: [`docs/agents/next-actions.md`](../docs/agents/next-actions.md) · env sample: [`.env.example`](./.env.example).

```bash
pnpm install
pnpm dev          # :5173, proxies /api and /v1 → localhost:8080
pnpm build        # → dist/
pnpm typecheck
pnpm test:run

# Production static publish (from repo root)
../deploy/scripts/deploy-web-static.sh
```

Env:

| Variable | Default | Meaning |
|----------|---------|---------|
| `VITE_API_BASE` | empty | Same-origin API prefix |
| `VITE_CONSOLE_ORIGIN` | auto | Console base for WeChat MP payment exception / rare deep-links (`console.you-box.com` in prod) |
| `VITE_DEV_PROXY_TARGET` | `http://localhost:8080` | Dev proxy backend |
| `VITE_DEV_PORT` | `5173` | Dev server port |
| `VITE_DESKTOP_RELEASE_REPO` | `fran0220/boxAI` | Desktop release assets |
