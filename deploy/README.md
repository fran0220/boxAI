# BoxAI deployment files

Production architecture and operations: [`docs/PRODUCTION.md`](../docs/PRODUCTION.md).

## Production path

```text
manual Deploy production(ref)
  → immutable commit
  → React build in Actions
  → local Docker builds on youbox
  → update sub2api + agent-gateway
  → React/Nginx publish
  → topology smoke
```

No production GHCR image/tag is required. Postgres, Redis, `/opt/boxAI/data`, and the host-only `.env` remain in place.

| Artifact | Purpose |
|---|---|
| `.github/workflows/deploy-production.yml` | Sole production entry |
| `scripts/ci-deploy.sh` | Commit staging, host build, backup, activation, rollback |
| `docker-compose.local.yml` | Shared services/environment/network definition |
| `docker-compose.production.yml` | Host-local build and absolute data-path override |
| `scripts/production-compose.sh` | Operate the active release without forgetting the override |
| `scripts/verify-topology.sh` | Public edge smoke |
| `nginx-you-box.com.conf` | Production host routing |

## Runtime layout

| Component | Runtime |
|---|---|
| React product/customer workspace | Nginx static docroot |
| Go API/model gateway + embedded Vue admin | `sub2api` container |
| Hosted Agent HTTP/WebSocket/gRPC relay | `boxai-agent-gateway` container |
| Postgres + Redis | Same host Compose project |
| Creator objects | External private Cloudflare R2 |

## Helpers

| Script | Use |
|---|---|
| `scripts/ci-deploy.sh` | Actions or break-glass full commit deploy |
| `scripts/production-compose.sh` | `ps`, `logs`, `restart` for active production |
| `scripts/apply-nginx-topology.sh` | First-time certificate/topology setup |
| `scripts/deploy-web-static.sh` | Emergency static-only repair |
| `scripts/verify-topology.sh` | Manual smoke |

Public image deployment (`DOCKER.md`, `docker-deploy.sh`, other Compose variants) remains available to downstream/self-hosted users, but it is not the youbox production release process.
