# BoxAI Agent Instructions

This repository is a **soft fork** of [Wei-Shaw/sub2api](https://github.com/Wei-Shaw/sub2api), productized as **BoxAI**.

Read this file before any non-trivial change. Detailed SOPs live under `docs/agents/`.

| Doc | Purpose |
|-----|---------|
| [Ownership zones](docs/agents/ownership-zones.md) | Path → sync-first / product-first / hybrid / frozen |
| [Change design](docs/agents/change-design.md) | How to write BE/FE code that survives upstream merges |
| [Upstream sync](docs/agents/upstream-sync.md) | Merge SOP, conflict policy, verification |
| [Deploy & release](docs/agents/deploy-release.md) | Compose, Docker publish, versioning |
| [PR checklist](docs/agents/pr-checklist.md) | Required checks before merge |
| [FORK_DELTA.md](FORK_DELTA.md) | Enumerated product delta vs upstream |
| [DEV_GUIDE.md](DEV_GUIDE.md) | Local env, CI versions, common pitfalls |
| [docs/BRAND.md](docs/BRAND.md) | Brand system (UI + legal freeze rules) |

## Identity

| Item | Value |
|------|--------|
| Product name | **BoxAI** |
| Origin | `fran0220/boxAI` |
| Upstream | `Wei-Shaw/sub2api` |
| Module path | keep `github.com/Wei-Shaw/sub2api` (do not rename) |
| Binary / service / DB name | keep `sub2api` |
| Public image | `ghcr.io/fran0220/boxai` (pin tags; never ship prod on `:latest`) |
| Version tag | `vX.Y.Z-box.N` where `X.Y.Z` is the merged upstream baseline |

## Hard rules (violations block PR)

1. **Delta must be enumerable** — every intentional edit to an upstream-owned file has a `// BOXAI:` / `<!-- BOXAI -->` marker and is listed in `FORK_DELTA.md`.
2. **Backend new features do not fork upstream files** — put code in product-first packages (`backend/internal/branding/`, future `backend/internal/boxai/`); wire with ≤ a few lines at router/setup points.
3. **Migrations** — fork-owned SQL only as `backend/migrations/9xx_boxai_*.sql` (forward-only, idempotent). Never edit applied `<900` upstream migrations.
4. **Compliance freeze** — `frontend/src/stores/adminCompliance.ts` legal phrases and `docs/legal/*` are **byte-stable**. CI enforces hashes. Product UI uses BoxAI; compliance copy keeps Sub2API wording.
5. **Upstream sync** — merge by upstream **release tag**, not tip; use **merge not rebase** on published `main`; sync PRs carry no feature work.
6. **No full-repo rebrand** — do not mass-rename `sub2api` binary, env vars, embed path, ports, `/health`, or DB names.

## Ownership snapshot

| Zone | Policy |
|------|--------|
| `backend/internal/{service,handler,repository}`, `backend/ent/`, `backend/cmd/` | **sync-first** — BOXAI markers only for product defaults/wiring |
| `backend/internal/branding/`, future `backend/internal/boxai/` | **product-first** |
| `backend/migrations/` `<900` | **sync-first (read-only for fork)** |
| `backend/migrations/9xx_boxai_*.sql` | **product-first** |
| `frontend/src/constants/brand.ts`, logos, BoxAI-only views | **product-first** |
| Other `frontend/src/` | **hybrid (product-leaning)** — brand via `brand.ts` |
| `adminCompliance.ts`, `docs/legal/` | **frozen** |
| `deploy/`, `.goreleaser*`, workflows | **hybrid** — structure upstream; image/URL product |
| `Dockerfile*` | **sync-first** (extra labels OK) |
| `README*`, `docs/BRAND.md`, this tree | **product-first** (keep LICENSE/CLA/disclaimers) |
| `backend/cmd/server/VERSION` | **sync-first** — always take upstream on merge |

## Anti-patterns

- ❌ Repo-wide `Sub2API` → `BoxAI` sed
- ❌ Copy-paste an upstream service file to “own” it
- ❌ Rename binary / env keys / embed path / DB name
- ❌ Edit or renumber applied migrations
- ❌ Hand-edit `ent/` generated code
- ❌ Change upstream API response shapes without config flag + delta entry
- ❌ Rebase published `main`
- ❌ Feature commits inside a sync PR
- ❌ Leave product delta uncommitted on a dirty tree before sync

## Default workflow for agents

1. Classify the path (ownership table).
2. Prefer config/seed over code; prefer `branding` / `brand.ts` over string literals.
3. If you must touch a sync-first file: minimal diff + `// BOXAI:` + update `FORK_DELTA.md`.
4. Run the relevant gates from `docs/agents/pr-checklist.md`.
5. Do not ask to “continue to the next phase” mid multi-step goal — finish the checklist.

## Tooling notes

- Frontend package manager: **pnpm** (`pnpm-lock.yaml` must stay in sync).
- Go toolchain: see `backend/go.mod` / release CI (currently **1.26.5**).
- Human-oriented env tips: `DEV_GUIDE.md`.
