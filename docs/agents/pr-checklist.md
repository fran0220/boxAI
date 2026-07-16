# PR checklist

Copy into the PR description when relevant.

## Every PR

- [ ] Path policy checked ([ownership-zones.md](./ownership-zones.md))
- [ ] If upstream-owned files changed: each site has `// BOXAI:` / `<!-- BOXAI -->` and `FORK_DELTA.md` updated
- [ ] New backend product code prefers `internal/branding` / `internal/boxai` over editing large upstream files
- [ ] New migrations are `9xx_boxai_*`, forward-only, idempotent
- [ ] New settings keys prefer `boxai_` prefix
- [ ] Brand strings use `brand.ts` / `internal/branding` (no new scattered literals)
- [ ] Did **not** touch `adminCompliance` legal phrases / `docs/legal/*` unless intentional + hash pin update
- [ ] Did **not** edit `backend/cmd/server/VERSION` except via release automation / upstream merge
- [ ] Backend tests / lint for touched packages
- [ ] Console (`frontend/`): lockfile updated with **pnpm** if `package.json` changed
- [ ] Product web (`web/`): if touched — `pnpm typecheck` + `pnpm test:run` (separate lockfile)
- [ ] Dual-frontend docs still accurate if URLs/topology/auth change (`WEB_PLATFORM.md` / `LOCAL_DEV.md` / `PRODUCTION.md`)
- [ ] If production edge or React UI ships: note `deploy-web-static.sh` / `verify-topology.sh` in PR

## Sync PR only

- [ ] Based on an upstream **release tag**
- [ ] No feature commits mixed in
- [ ] Conflicts resolved per zone policy
- [ ] Migration replay verified
- [ ] Docker smoke verified
- [ ] Brand / compliance greps clean
- [ ] `FORK_DELTA.md` baseline version updated

## Release PR / tag

- [ ] Merged upstream baseline recorded in tag `vX.Y.Z-box.N`
- [ ] Image pin documented for operators (`BOXAI_IMAGE`)
- [ ] `simple_release` only for non-prod / amd64-only hotfixes
- [ ] If `web/` changed: static deploy planned (image alone does **not** update apex HTML)
- [ ] Topology smoke: `./deploy/scripts/verify-topology.sh` after edge/web cutover
