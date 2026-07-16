# PR checklist

## Every PR

- [ ] Path policy checked ([ownership-zones.md](./ownership-zones.md))
- [ ] Sync-first files: `// BOXAI:` / `<!-- BOXAI -->` + `FORK_DELTA.md` row
- [ ] New backend product code in product-first packages; minimal route wire
- [ ] Migrations: `9xx_boxai_*` only, forward-only, idempotent
- [ ] Settings keys: prefer `boxai_` prefix
- [ ] Brand via `brand.ts` / `web/src/lib/brand.ts` / `internal/branding`
- [ ] No drive-by edits to `adminCompliance` / `docs/legal/*` (or update hash pins)
- [ ] No hand-edit of `backend/cmd/server/VERSION` (except release/upstream)
- [ ] Backend tests/lint for touched packages
- [ ] Console (`frontend/`): pnpm lockfile if `package.json` changed; typecheck/lint as needed
- [ ] Product web (`web/`): typecheck + tests if touched
- [ ] Topology/auth docs updated if hosts, SSO, or deploy paths change

## Sync PR

- [ ] Upstream **release tag** only
- [ ] No product features mixed in
- [ ] Conflicts per ownership zones
- [ ] Migration + brand + compliance checks green
- [ ] `FORK_DELTA.md` baseline bumped

## Release / production ship

- [ ] Tag `vX.Y.Z-box.N` matches upstream baseline `X.Y.Z`
- [ ] `BOXAI_IMAGE` pin recorded for operators
- [ ] `web/` changes: static deploy + `verify-topology.sh`
- [ ] Image-only: confirm apex HTML does not need a web rebuild
