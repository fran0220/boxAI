# Deploy and release

## Production

| Item | Value |
|------|--------|
| SSH | `youbox` (`160.187.1.155`) |
| Product | `https://you-box.com` — React `/var/www/you-box.com` + proxy `/api` `/v1` `/health` |
| Console | `https://console.you-box.com` — proxy to Go embed |
| API | `https://api.you-box.com` — model gateway + hosted Agent WebUI/WebSocket/gRPC + public desktop tokens |
| App dir | `/opt/boxAI` |
| Compose | `docker-compose.yml` (from `deploy/docker-compose.local.yml`) |
| Image | `ghcr.io/fran0220/boxai:<pin>` |
| Agent image | `ghcr.io/fran0220/boxai-agent-gateway:<pin>` |
| Listen | `127.0.0.1:8080` |
| Edge | `deploy/nginx-you-box.com.conf` · `deploy/Caddyfile.you-box.com` |
| Data | PostgreSQL 18 + Redis 8 **on host compose** (unchanged by deploy) |

Ops: [PRODUCTION.md](../PRODUCTION.md) · Architecture: [WEB_PLATFORM.md](../WEB_PLATFORM.md).

## Primary release path (only)

```
main green (CI + Fork Gates)
    → git tag vX.Y.Z-box.N && push
    → workflow Release          # build + push GHCR (version tag WITHOUT leading v)
    → workflow Deploy production  # pin compose images + build/rsync web + verify-topology
```

| Workflow | Role |
|----------|------|
| `backend-ci.yml` / `fork-gates.yml` | Test only — **never** deploys |
| `release.yml` | Tag → GHCR image(s) |
| **`deploy-production.yml`** | **Sole production deploy entry** |

### Deploy modes (`workflow_dispatch` or after Release)

| Mode | App image | React static | Use |
|------|-----------|--------------|-----|
| `full` | pin + pull + up | build + rsync | Normal release (default after tag) |
| `app` | pin + pull + up | — | Hotfix API/console embed only |
| `web` | — | build + rsync | Hotfix apex marketing/workspace UI |

Orchestrator: [`deploy/scripts/ci-deploy.sh`](../../deploy/scripts/ci-deploy.sh).

```bash
# Normal
git tag v0.1.155-box.11 && git push origin v0.1.155-box.11

# Manual
gh workflow run deploy-production.yml -R fran0220/boxAI -f mode=web
gh workflow run deploy-production.yml -R fran0220/boxAI -f mode=app -f image_tag=0.1.155-box.11
gh workflow run deploy-production.yml -R fran0220/boxAI -f mode=full -f image_tag=0.1.155-box.11
```

### GitHub secrets / env

| Name | Kind | Purpose |
|------|------|---------|
| `production` | Environment | Deploy job; optional reviewers |
| `DEPLOY_SSH_KEY` | Secret | Deploy private key |
| `DEPLOY_HOST` | Secret | Host IP/name |
| `DEPLOY_USER` | Secret | SSH user |
| `DEPLOY_APP_DIR` | Variable | Default `/opt/boxAI` |
| `DEPLOY_DOCROOT` | Variable | Default `/var/www/you-box.com` |

Server must allow: SSH, `docker compose` in app dir, write docroot, pull from GHCR.

## Retired as primary path

Do **not** document these as the normal ship process:

| Old habit | Replacement |
|-----------|-------------|
| Local `./deploy/scripts/deploy-web-static.sh` then SSH | Deploy `mode=web` or `full` |
| SSH `sed` `BOXAI_IMAGE` + `docker compose pull/up` | Deploy `mode=app` or `full` |
| Ad-hoc mix of the two | Single Actions entry |
| Production pin `:latest` | Forbidden |

Emergency only: `deploy-web-static.sh` (prints warning), `ci-deploy.sh` with local SSH key, `apply-nginx-topology.sh` for edge conf.

## Deploy standards

| Choice | Standard |
|--------|----------|
| Compose | `deploy/docker-compose.local.yml` on host |
| Product web | Static `web/dist` on edge (not in image) |
| Image content | Vue console embed + Go API |
| Data plane | Postgres + Redis containers — **never** recreated by Deploy |

### Do not change

- Env variable names  
- Volume `/app/data`  
- Port `8080`  
- `/health`  
- `AUTO_SETUP`, entrypoint migrations, `schema_migrations`  
- Binary/service name `sub2api`  

### Rules

- Never prod `:latest`.
- Pin tag or digest; keep N-1 image for rollback (re-run Deploy with previous `image_tag`).
- Migrations forward-only.
- React UI change requires Deploy `web` or `full` (image alone is not enough).
- Deploy must not `compose down -v` or touch `postgres_data` / `redis_data`.

## Release

| Item | Value |
|------|--------|
| Registry | `ghcr.io/fran0220/boxai` |
| Tag | `vX.Y.Z-box.N` (git) → image `X.Y.Z-box.N` |
| Full | multi-arch GoReleaser |
| Hotfix | `simple_release` (amd64) via `release.yml` workflow_dispatch |
| Image frontend install | `frontend/` pnpm only |
| React | `web/` built in Deploy job |

### Gate order

1. `main` green (CI + Fork Gates).  
2. Compliance + migration lint.  
3. Image release (`release.yml`).  
4. Deploy production (`full` after tag, or manual mode).  
5. Confirm Actions smoke / `verify-topology` green.  
