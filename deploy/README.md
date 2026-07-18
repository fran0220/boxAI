# BoxAI / Sub2API deployment files

Docker and edge configs for **BoxAI** (product) built on the Sub2API gateway stack.

**Production dual-frontend (you-box.com):** [docs/PRODUCTION.md](../docs/PRODUCTION.md) · [docs/WEB_PLATFORM.md](../docs/WEB_PLATFORM.md) · [docs/agents/deploy-release.md](../docs/agents/deploy-release.md).

| Host | Serves |
|------|--------|
| `you-box.com` | React static (`web/dist`) + proxy `/api` `/v1` |
| `console.you-box.com` | Go image (Vue console embed) |
| `api.you-box.com` | Edge-filtered gateway + Agent relay |

## Production ship (single path)

```
tag vX.Y.Z-box.N → Release (GHCR) → Deploy production (pin images + web + smoke)
```

| Artifact | Path |
|----------|------|
| Workflow | `.github/workflows/deploy-production.yml` |
| Orchestrator | `scripts/ci-deploy.sh` |
| Smoke | `scripts/verify-topology.sh` |

Postgres + Redis stay in the host compose project; Deploy never recreates data volumes.

### Modes

| Mode | Effect |
|------|--------|
| `full` | App + agent pin/up + React rsync |
| `app` | Image pin/up only |
| `web` | React build + rsync only |

## Local / emergency helpers (not primary)

| Script | When |
|--------|------|
| `scripts/ci-deploy.sh` | Same as CI, with local `DEPLOY_*` env (break-glass) |
| `scripts/deploy-web-static.sh` | Emergency static only (prints warning) |
| `scripts/apply-nginx-topology.sh` | Infrequent nginx/cert changes |
| `scripts/verify-topology.sh` | Manual smoke |

## Runtime methods

| Method | Best for |
|--------|----------|
| **Docker Compose on VPS** | Production app + Postgres + Redis (youbox) |
| **Nginx / Caddy dual-frontend** | Product hosts |
| **Apple container** | Local macOS 26 stack only |
| **Binary + systemd** | Optional non-Docker app process (not the default prod path) |

## Files

| File | Description |
|------|-------------|
| `docker-compose.local.yml` | **Production compose template** (local dirs) |
| `docker-compose.yml` | Named-volume variant |
| `docker-compose.standalone.yml` | Standalone experiments |
| `docker-compose.dev.yml` | Dev |
| `nginx-you-box.com.conf` | Production multi-host nginx |
| `Caddyfile.you-box.com` | Caddy alternative |
| `scripts/ci-deploy.sh` | **CI/production deploy orchestrator** |
| `.env.example` | Env template (pin `BOXAI_IMAGE`) |
| `DOCKER.md` | Image notes |
| `docker-deploy.sh` | **Bootstrap / legacy one-click prepare** — not the BoxAI production release path |
| `apple-container.sh` | Local Apple container lifecycle |
| `install.sh` / `*.service` | Binary install (optional) |

## Bootstrap a new host (once)

1. Install Docker Engine + Compose v2, nginx, certbot.  
2. Copy compose + `.env` to `/opt/boxAI` (see PRODUCTION.md §4).  
3. `docker compose up -d` (includes Postgres/Redis).  
4. `apply-nginx-topology.sh` for TLS hosts.  
5. Configure GitHub `production` secrets and run **Deploy production** `mode=full`.

Do not use `curl … \| bash` upstream `docker-deploy.sh` as the ongoing BoxAI release process.

## Apple container (local only)

```bash
./apple-container.sh init && ./apple-container.sh up
```

See [APPLE_CONTAINER.md](./APPLE_CONTAINER.md). Production remains Docker Compose on youbox + Actions Deploy.
