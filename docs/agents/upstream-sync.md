# Upstream sync SOP

## Topology

```
upstream        → remote Wei-Shaw/sub2api
upstream-main   → pure mirror branch (fast-forward only; no product commits)
main            → product branch = upstream baseline + BoxAI delta
```

## Cadence

| Rule | Value |
|------|--------|
| Unit of sync | Upstream **release tag** `vX.Y.Z` (not arbitrary main tip) |
| Frequency | Every upstream tag, or at least every two weeks |
| Integration method | `git merge` (do **not** rebase published `main`) |
| PR scope | Sync only — no product features |

## Steps

1. **Preflight**
   - Working tree clean: `git status --porcelain` empty.
   - `FORK_DELTA.md` matches reality (`// BOXAI:` count and listed paths).
2. **Refresh mirror**
   ```bash
   git fetch upstream --tags
   git checkout upstream-main
   git merge --ff-only upstream/main   # or reset --hard to the target tag
   git checkout main
   ```
3. **Branch**
   ```bash
   git checkout -b sync/vX.Y.Z main
   git merge vX.Y.Z   # the upstream tag
   ```
4. **Resolve conflicts by zone** (see [ownership-zones.md](./ownership-zones.md))
   - Backend core: **theirs**, then replay BOXAI lines from `FORK_DELTA.md`.
   - `VERSION`: always **theirs**.
   - Frontend brand files: keep ours where product-first; for hybrid locale files take theirs and re-apply brand keys.
   - If upstream **deleted** an extension point we depend on: stop the merge and design a new integration before continuing.
5. **Delta integrity**
   - `git diff vX.Y.Z...HEAD` should match the product delta inventory.
   - `grep -R "BOXAI:" backend frontend deploy` consistent with `FORK_DELTA.md`.
6. **Verification** (all required)
   - Backend: unit + integration + golangci-lint as in CI.
   - Frontend: `pnpm install --frozen-lockfile`, lint/typecheck/critical tests.
   - Migrations: fresh DB full apply including any `9xx_boxai_*`; optional incremental on a prod-like dump.
   - Docker smoke: build image → compose up → `/health` 200 → landing shows BoxAI → compliance hash OK.
   - Brand grep: product UI not leaking `Sub2API` (whitelist compliance/LICENSE/attribution); `docs/legal` must not contain `BoxAI`.
7. **Land**
   - Open a sync-only PR into `main`.
   - Commit message records the upstream tag (e.g. `chore(sync): merge upstream v0.1.155`).

## After landing

- BoxAI release tag (when publishing): `vX.Y.Z-box.N` based on the merged upstream `X.Y.Z`.
- Update `FORK_DELTA.md` “Baseline” section to the new upstream tag.
