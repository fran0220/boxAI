# Deploy and public Docker release

## Live production (dual-frontend, 2026-07-16+)

| Item | Value |
|------|--------|
| SSH host | `youbox` (`160.187.1.155`) |
| Product apex | `https://you-box.com` — React static `/var/www/you-box.com` + proxy `/api` `/v1` `/health` |
| Console | `https://console.you-box.com` — full reverse proxy to Go embed (Vue) |
| API | `https://api.you-box.com` — edge-filtered gateway + public token paths |
| App dir | `/opt/boxAI` |
| Compose | `docker-compose.yml` (from `deploy/docker-compose.local.yml`) |
| Image | `ghcr.io/fran0220/boxai:<pin>` (e.g. `0.1.155-box.10`) |
| Listen | `127.0.0.1:8080` |
| Edge config | `deploy/nginx-you-box.com.conf` (live) · `deploy/Caddyfile.you-box.com` (alt) |
| Admin email | `admin@you-box.com` (password on host: `/root/.boxai-admin-password`) |
| Data services | **PostgreSQL 18** + **Redis 8** via same compose |

**Full ops doc:** [docs/PRODUCTION.md](../PRODUCTION.md) · **Architecture:** [docs/WEB_PLATFORM.md](../WEB_PLATFORM.md)

### Dual-frontend publish helpers

```bash
# React static → production docroot
./deploy/scripts/deploy-web-static.sh

# Install/reload nginx multi-host + expand LE cert
./deploy/scripts/apply-nginx-topology.sh

# HTTP smoke (apex / console / api)
./deploy/scripts/verify-topology.sh
```

### App image upgrade

```bash
ssh youbox
cd /opt/boxAI
# bump BOXAI_IMAGE in .env to a new public tag
docker compose pull
docker compose up -d
curl -fsS http://127.0.0.1:8080/health
curl -fsS https://you-box.com/health
curl -fsS https://console.you-box.com/health
curl -fsS https://api.you-box.com/health
```

## Canonical production deploy

| Choice | Standard |
|--------|----------|
| Default path | `deploy/docker-compose.local.yml` + fork `docker-deploy.sh` |
| Alternate | Named-volume `docker-compose.yml` |
| Non-Docker | Binary + systemd (`install.sh`) only when Docker is unavailable |
| Apple Silicon local | `apple-container.sh` (still pin app image tags) |
| Product web | **Not** in Docker image; static `web/dist` via nginx/Caddy |

### Compatibility (do not change)

- Env variable **names**
- Volume mount `/app/data`
- Host/container port **8080**
- Health endpoint `/health`
- `AUTO_SETUP` behavior
- Entrypoint migration application
- `schema_migrations` mechanism
- Binary/service name `sub2api`

### BoxAI-allowed deltas

- Image reference: `${BOXAI_IMAGE:-ghcr.io/fran0220/boxai:<pinned-tag>}`
- `docker-deploy.sh` raw GitHub URL → this fork
- Brand-related admin defaults (via settings/seed preferred)
- Dual-frontend edge hosts + React static docroot
- Desktop release workflow (`desktop-v*` tags)

### Production rules

- **Never** run production on `:latest`.
- Pin a concrete tag or digest.
- Before upgrade: `pg_dump` backup; keep N-1 image available.
- Migrations are forward-only — plan rollback as restore dump + previous image.
- Advance versions tag-by-tag when migration chains require it.
- After React UI changes: run `deploy-web-static.sh` (image bump alone does not update apex HTML).

## Public image release

| Item | Standard |
|------|----------|
| Registry image | `ghcr.io/fran0220/boxai` |
| Internal names | remain `sub2api` (binary, compose service, DB) |
| Version tag | `vX.Y.Z-box.N` (`X.Y.Z` = merged upstream baseline) |
| Formal release | full multi-arch GoReleaser (amd64 + arm64) |
| Internal/RC | `simple_release` (x86 GHCR only) via workflow_dispatch |
| Frontend install (image) | `pnpm install --frozen-lockfile` under **`frontend/` only** (Vue embed) |
| React web | built separately; not in multi-stage Dockerfile |
| Go version | pinned by `backend/go.mod` + release CI check |

### Publish gates (order)

1. `main` green (CI + Fork Gates).
2. compliance-hash + migration-lint green.
3. Docker build smoke / `simple_release` or full release.
4. (If web UI changed) `deploy-web-static.sh` + `verify-topology.sh`.
