# Deploy and release

## Production

| Item | Value |
|------|--------|
| SSH | `youbox` (`160.187.1.155`) |
| Customer shell | `https://you-box.com` — React `/var/www/you-box.com` + allowlisted `/api` + `/v1` + `/health` |
| Admin console | `https://console.you-box.com` — proxy to Go embed (Vue) |
| API | `https://api.you-box.com` — filtered gateway (API Key; no browser session) |
| App dir | `/opt/boxAI` |
| Compose | `docker-compose.yml` (from `deploy/docker-compose.local.yml`) |
| Image | `ghcr.io/fran0220/boxai:<pin>` |
| Listen | `127.0.0.1:8080` |
| Edge | `deploy/nginx-you-box.com.conf` · `deploy/Caddyfile.you-box.com` |
| Data | PostgreSQL 18 + Redis 8 in compose |

Ops detail: [PRODUCTION.md](../PRODUCTION.md) · Architecture: [WEB_PLATFORM.md](../WEB_PLATFORM.md).

## Publish helpers

```bash
./deploy/scripts/deploy-web-static.sh      # React → docroot
./deploy/scripts/apply-nginx-topology.sh   # nginx + certs
./deploy/scripts/verify-topology.sh        # HTTP smoke
```

## Image upgrade

```bash
ssh youbox
cd /opt/boxAI
# BOXAI_IMAGE=ghcr.io/fran0220/boxai:<tag>
docker compose pull
docker compose up -d
curl -fsS http://127.0.0.1:8080/health
curl -fsS https://you-box.com/health
curl -fsS https://console.you-box.com/health
curl -fsS https://api.you-box.com/health
```

## Deploy standards

| Choice | Standard |
|--------|----------|
| Compose | `deploy/docker-compose.local.yml` |
| Product web | Static `web/dist` on edge (not in image) |
| Image content | Vue console embed + Go API |

### Do not change

- Env variable names  
- Volume `/app/data`  
- Port `8080`  
- `/health`  
- `AUTO_SETUP`, entrypoint migrations, `schema_migrations`  
- Binary/service name `sub2api`  

### Allowed product deltas

- `BOXAI_IMAGE` pin  
- Edge multi-host + React docroot  
- Desktop `desktop-v*` releases  

### Rules

- Never prod `:latest`.
- Pin tag or digest; keep N-1 image for rollback.
- Migrations forward-only.
- React UI change requires static deploy (image alone is not enough).

## Release

| Item | Value |
|------|--------|
| Registry | `ghcr.io/fran0220/boxai` |
| Tag | `vX.Y.Z-box.N` |
| Full | multi-arch GoReleaser |
| Hotfix | `simple_release` (amd64) via workflow_dispatch |
| Image frontend install | `frontend/` pnpm only |
| React | separate `web/` build |

### Gate order

1. `main` green (CI + Fork Gates).  
2. Compliance + migration lint.  
3. Image release.  
4. If `web/` or edge allowlist changed: apply nginx/Caddy if needed → `deploy-web-static.sh` → `verify-topology.sh`.  
5. If customer OAuth enabled: confirm provider `redirect_uri` includes apex host (see [next-actions.md](./next-actions.md) P0-1).
