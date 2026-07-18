# Production deploy and public release

Production and public artifacts are intentionally separate.

## Production: one host, one commit

| Item | Standard |
|---|---|
| Entry | Manual `.github/workflows/deploy-production.yml` |
| Input | Branch, tag, or immutable commit SHA |
| Host | `youbox`, application root `/opt/boxAI` |
| Runtime | Docker Compose on the host |
| App images | Built locally as `boxai-local/*:<commit>`; no registry |
| React | Built/tested in Actions, synchronized to `/var/www/you-box.com` |
| Data | Existing Postgres 18 + Redis 8 + `/opt/boxAI/data` |
| External store | Private Cloudflare R2 configured only in host `.env` |

```bash
gh workflow run deploy-production.yml -R fran0220/boxAI -f ref=main
```

The workflow resolves the ref to a full SHA. `deploy/scripts/ci-deploy.sh` transfers only that commit's `git archive`, builds the Go API and hosted Agent Relay on the server, backs up state, updates the two stateless application containers, publishes React/Nginx, and runs topology smoke checks.

### Invariants

- No tag, Release workflow, GHCR permission, or package token is needed.
- Never upload `.env`, R2 keys, DB data, or runtime data from CI.
- Never run `compose down -v`; routine deploy does not recreate Postgres/Redis.
- Fail closed unless existing Postgres/Redis belong to Compose project `boxai` and mount the configured host data directories.
- React remains edge-static; the root Dockerfile embeds Vue only.
- `api.you-box.com` is the unified public gateway, while Agent Relay remains a separate process because it owns WS/gRPC/long-lived session behavior.
- Migrations are forward-only and run from the Go app entrypoint.
- On activation failure, restore the prior app, Nginx, and static site from the automatic backup.

### Required GitHub configuration

Production environment secrets: `DEPLOY_SSH_KEY`, `DEPLOY_HOST`, `DEPLOY_USER`. Optional vars: `DEPLOY_APP_DIR`, `DEPLOY_DOCROOT`, `VITE_AGENT_REMOTE_URL`.

### Verification

```bash
ssh youbox /opt/boxAI/current/deploy/scripts/production-compose.sh ps
ssh youbox cat /opt/boxAI/current/.boxai-commit
./deploy/scripts/verify-topology.sh
```

See [`docs/PRODUCTION.md`](../PRODUCTION.md) for bootstrap, service inventory, backups, and acceptance.

## Public release: optional artifact publishing

`release.yml` remains available for public GHCR images and Go artifacts; `desktop-release.yml` publishes desktop installers. Neither workflow deploys production or triggers `Deploy production`.

| Target | Versioning |
|---|---|
| Public backend image / binaries | `vX.Y.Z-box.N` |
| Desktop installers | desktop release tag policy |
| Production | exact Git commit SHA |

## Break-glass

From a clean checkout at the commit to deploy, build `web/dist`, then run:

```bash
export DEPLOY_HOST=… DEPLOY_USER=… DEPLOY_SSH_KEY_PATH=…
export COMMIT_SHA="$(git rev-parse HEAD)"
./deploy/scripts/ci-deploy.sh
```

`deploy-web-static.sh` and `apply-nginx-topology.sh` are narrow emergency/bootstrap helpers, not the normal release path.
