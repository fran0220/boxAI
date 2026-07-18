# Upstream sync

## Branches

```
upstream        → Wei-Shaw/sub2api
upstream-main   → pure mirror (no product commits)
main            → upstream baseline + BoxAI delta
```

## Rules

| Rule | Value |
|------|--------|
| Sync unit | Upstream **release tag** `vX.Y.Z` |
| Integration | `git merge` (no rebase of published `main`) |
| PR scope | Sync only — no product features |

## Steps

1. **Preflight** — clean tree; `FORK_DELTA.md` matches markers.
2. **Mirror**
   ```bash
   git fetch upstream --tags
   git checkout upstream-main
   git merge --ff-only upstream/main
   git checkout main
   ```
3. **Branch + merge**
   ```bash
   git checkout -b sync/vX.Y.Z main
   git merge vX.Y.Z
   ```
4. **Conflicts by zone** ([ownership-zones.md](./ownership-zones.md))
   - Backend core: **theirs**, then replay BOXAI from `FORK_DELTA.md`.
   - `VERSION`: **theirs**.
   - Hybrid frontend: theirs + re-apply brand keys.
   - Product-first (`web/`, `desktop/`, `handler/boxai_*`, edge configs): **ours**.
   - Upstream removed an extension point we need: stop and redesign wiring.
5. **Integrity**
   - `git diff vX.Y.Z...HEAD` matches product inventory.
   - `grep -R "BOXAI:" backend frontend deploy` consistent with `FORK_DELTA.md`.
6. **Verify**
   - Backend unit/integration/lint as CI.
   - Console: `cd frontend && pnpm install --frozen-lockfile` + typecheck/lint.
   - Product web: `cd web && pnpm install --frozen-lockfile` + typecheck + tests.
   - Migrations: fresh apply including `9xx_boxai_*`.
   - Docker smoke: image → compose → `/health` → console brand OK → compliance hash OK.
   - Brand grep: product UI not `Sub2API` (except compliance/LICENSE); `docs/legal` has no `BoxAI`.
7. **Land** — sync-only PR; message names the upstream tag.

## After land

- Publish tag when shipping: `vX.Y.Z-box.N`.
- Set `FORK_DELTA.md` baseline to the merged upstream tag.
- If only image changes: Deploy production `mode=app` with the new tag. If `web/` also changed: `mode=full` (or `web`).
