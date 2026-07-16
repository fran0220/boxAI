# BoxAI Docker Image

Public multi-arch image for the BoxAI AI API Gateway (product surface on top of the Sub2API gateway stack).

| Item | Value |
|------|--------|
| Registry | GitHub Container Registry |
| Image | `ghcr.io/fran0220/boxai` |
| Visibility | **Public** (no login required to pull) |
| Tag scheme | `X.Y.Z-box.N` (aligned with git tag `vX.Y.Z-box.N`) |
| Embeds | **Vue console only** (`frontend/` → Go `embed`) |
| Does **not** include | React marketing/Creator (`web/` is static on the edge) |

Production dual-frontend topology: [docs/WEB_PLATFORM.md](../docs/WEB_PLATFORM.md) · [docs/PRODUCTION.md](../docs/PRODUCTION.md) · nginx: [nginx-you-box.com.conf](./nginx-you-box.com.conf).

## Quick Start

```bash
# Prefer a pinned release tag in production
docker pull ghcr.io/fran0220/boxai:0.1.155-box.2

docker run -d \
  --name boxai \
  -p 8080:8080 \
  -e AUTO_SETUP=true \
  -e DATABASE_HOST=... \
  -e DATABASE_PASSWORD=... \
  -e REDIS_HOST=... \
  -e JWT_SECRET=... \
  -e TOTP_ENCRYPTION_KEY=... \
  ghcr.io/fran0220/boxai:0.1.155-box.2
```

For a full stack (app + PostgreSQL + Redis), use the compose files in this directory:

```bash
export BOXAI_IMAGE=ghcr.io/fran0220/boxai:0.1.155-box.2
cp .env.example .env   # set secrets; pin BOXAI_IMAGE
docker compose -f docker-compose.local.yml up -d
```

## Docker Compose snippet

```yaml
services:
  sub2api:
    image: ${BOXAI_IMAGE:-ghcr.io/fran0220/boxai:0.1.155-box.2}
    ports:
      - "8080:8080"
    environment:
      - AUTO_SETUP=true
      # ... see .env.example
```

> Service/container names remain `sub2api` for upstream deploy compatibility. Only the **image reference** is BoxAI-branded.

## Tags

| Tag | Meaning |
|-----|---------|
| `X.Y.Z-box.N` | Immutable product release (recommended for production) |
| `latest` | Points at the newest product release (moving target) |
| `X.Y` / `X` | Convenience major/minor pointers from GoReleaser manifests |

## Notes

- Image is **public**: `docker pull` works without `docker login` for anonymous pulls (GitHub may rate-limit unauthenticated pulls).
- Inside the image the binary is still named `sub2api` (upstream contract).
- Upgrade: pin a new tag, take a `pg_dump` backup, then recreate the container/compose stack.
