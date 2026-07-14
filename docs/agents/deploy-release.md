# Deploy and public Docker release

## Live production host (cutover 2026-07-15)

| Item | Value |
|------|--------|
| SSH host | `youbox` (`160.187.1.155`) |
| Domain | `https://you-box.com` |
| App dir | `/opt/boxAI` |
| Compose | `docker-compose.yml` (from `deploy/docker-compose.local.yml`) |
| Image | `ghcr.io/fran0220/boxai:0.1.155-box.2` (pin releases) |
| Listen | `127.0.0.1:8080` |
| Reverse proxy | Nginx `you-box.com` → `127.0.0.1:8080` |
| Admin email | `admin@you-box.com` (password on host: `/root/.boxai-admin-password`) |
| Data services | **PostgreSQL 18** + **Redis 8** via same compose (healthy) |
| Legacy you-box | **Purged** (archive dir, images, `you-box_pg_data` deleted 2026-07-15) |

**完整生产文档（推荐阅读）：** [docs/PRODUCTION.md](../PRODUCTION.md)

```bash
ssh youbox
cd /opt/boxAI
# bump BOXAI_IMAGE in .env to a new public tag
docker compose pull
docker compose up -d
curl -fsS http://127.0.0.1:8080/health
curl -fsSI https://you-box.com/health | head
```

## Canonical production deploy

| Choice | Standard |
|--------|----------|
| Default path | `deploy/docker-compose.local.yml` + fork `docker-deploy.sh` |
| Alternate | Named-volume `docker-compose.yml` |
| Non-Docker | Binary + systemd (`install.sh`) only when Docker is unavailable |
| Apple Silicon local | `apple-container.sh` (still pin app image tags) |

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

### Production rules

- **Never** run production on `:latest`.
- Pin a concrete tag or digest.
- Before upgrade: `pg_dump` backup; keep N-1 image available.
- Migrations are forward-only — plan rollback as restore dump + previous image.
- Advance versions tag-by-tag when migration chains require it.

## Public image release

| Item | Standard |
|------|----------|
| Registry image | `ghcr.io/fran0220/boxai` |
| Internal names | remain `sub2api` (binary, compose service, DB) |
| Version tag | `vX.Y.Z-box.N` (`X.Y.Z` = merged upstream baseline) |
| Formal release | full multi-arch GoReleaser (amd64 + arm64) |
| Internal/RC | `simple_release` (x86 GHCR only) via workflow_dispatch |
| Frontend install | `pnpm install --frozen-lockfile` |
| Go version | pinned by `backend/go.mod` + release workflow check |

### Publish gates (order)

1. `main` green (CI).
2. compliance-hash + migration-lint green.
3. Docker build smoke locally or in CI.
4. Annotated git tag on the release commit.
5. `release.yml` publishes artifacts.
6. Pull published image; compose smoke (`/health` + version string).

### VERSION file policy

`backend/cmd/server/VERSION` tracks upstream on merge. BoxAI public identity is the **git/image tag** (`-box.N`), not a divergent VERSION file history.
