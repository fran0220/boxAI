# BoxAI Agent Instructions

Soft fork of [Wei-Shaw/sub2api](https://github.com/Wei-Shaw/sub2api), productized as **BoxAI**.

Read this before non-trivial work. SOPs: [`docs/agents/`](docs/agents/README.md).

## Product map

| Surface | Host | Code | Stack |
|---------|------|------|--------|
| Marketing + Creator | `you-box.com` | `web/` | React (Vite), static on edge |
| User + admin console | `console.you-box.com` | `frontend/` | Vue 3, embedded in Go |
| Gateway API | `api.you-box.com` | `backend/` | Go; edge-filtered paths |
| Desktop | installers | `desktop/` | Tauri |

Architecture: [docs/WEB_PLATFORM.md](docs/WEB_PLATFORM.md) · Local: [docs/LOCAL_DEV.md](docs/LOCAL_DEV.md) · Ops: [docs/PRODUCTION.md](docs/PRODUCTION.md).

**Production config:** change SMTP / site settings via **Admin API** on `https://console.you-box.com` only (not apex `you-box.com`). Ops secrets live in `/root/.boxai/admin-api.env` or `~/.config/boxai/admin.env` — never commit.

## Identity

| Item | Value |
|------|--------|
| Product | **BoxAI** |
| Repo | `fran0220/boxAI` |
| Upstream | `Wei-Shaw/sub2api` |
| Go module | `github.com/Wei-Shaw/sub2api` (do not rename) |
| Binary / service / DB | `sub2api` |
| Image | `ghcr.io/fran0220/boxai` (pin tag; never prod `:latest`) |
| Release tag | `vX.Y.Z-box.N` (`X.Y.Z` = upstream baseline) |
| Docker image embeds | **Vue only** (`frontend/` → `backend/internal/web/dist`) |
| React ship path | `web/dist` → `/var/www/you-box.com` via `deploy/scripts/deploy-web-static.sh` |

## Agent docs

| Doc | Role |
|-----|------|
| [docs/agents/README.md](docs/agents/README.md) | Agent SOP index |
| [ownership-zones.md](docs/agents/ownership-zones.md) | Path → policy |
| [change-design.md](docs/agents/change-design.md) | How to write merge-safe code |
| [upstream-sync.md](docs/agents/upstream-sync.md) | Merge upstream release tags |
| [deploy-release.md](docs/agents/deploy-release.md) | Image + edge publish |
| [pr-checklist.md](docs/agents/pr-checklist.md) | PR gates |
| [FORK_DELTA.md](FORK_DELTA.md) | Enumerated product delta |
| [docs/BRAND.md](docs/BRAND.md) | Brand + compliance freeze |
| [DEV_GUIDE.md](DEV_GUIDE.md) | Tooling and CI |

## Hard rules

1. **Enumerable delta** — every intentional change to an upstream-owned file has `// BOXAI:` / `<!-- BOXAI -->` and a row in `FORK_DELTA.md`.
2. **Product features stay product-first** — new backend logic in `backend/internal/branding/`, `backend/internal/handler/boxai_*.go`, or `backend/internal/boxai/`; wire with a few lines in router/setup only.
3. **Migrations** — BoxAI SQL only as `backend/migrations/9xx_boxai_*.sql` (forward-only, idempotent). Never edit applied migrations with version `<900`.
4. **Compliance freeze** — `frontend/src/stores/adminCompliance.ts` and `docs/legal/*` are byte-stable (CI hashes). Product UI says BoxAI; legal ack copy keeps Sub2API wording.
5. **Upstream sync** — merge by upstream **release tag**; **merge not rebase** on published `main`; sync PRs contain no feature work.
6. **No full-repo rebrand** — do not mass-rename binary, env keys, embed path, ports, `/health`, or DB names.
7. **Do not embed React in Go** — apex HTML is edge-static; image rebuild does not update `you-box.com` without `deploy-web-static.sh`.

## Ownership (summary)

Full table: [ownership-zones.md](docs/agents/ownership-zones.md).

| Policy | Meaning |
|--------|---------|
| **sync-first** | Prefer upstream on conflict; local edits = markers + `FORK_DELTA.md` |
| **product-first** | BoxAI owns the path |
| **hybrid** | Upstream structure; product URLs/images/brand |
| **frozen** | Byte-stable; CI hash |

| Zone | Policy |
|------|--------|
| `backend/internal/{service,handler,repository}`, `ent/`, `cmd/` | sync-first |
| `backend/internal/branding/`, `handler/boxai_*.go`, `routes/boxai_*.go` | product-first |
| `web/`, `desktop/` | product-first |
| `frontend/` (except brand/logos/BoxAI-only views) | hybrid |
| `adminCompliance.ts`, `docs/legal/` | frozen |
| `deploy/nginx-you-box.com.conf`, `Caddyfile.you-box.com`, `scripts/*` | product-first |
| Other `deploy/`, workflows, goreleaser | hybrid |
| `Dockerfile*` | sync-first (Vue embed only) |
| Migrations `<900` | sync-first read-only |
| Migrations `9xx_boxai_*` | product-first |

## Anti-patterns

- Repo-wide `Sub2API` → `BoxAI` replace
- Copying an upstream service file to “own” it
- Renaming binary / env keys / embed path / DB
- Editing applied migrations or hand-editing `ent/`
- Changing upstream API shapes without flag + `FORK_DELTA` row
- Rebase of published `main`
- Feature commits inside a sync PR
- Putting Creator/marketing UI into Vue console instead of `web/`
- Shipping apex React only via Docker image (without static deploy)

## Workflow

1. Classify path ([ownership-zones.md](docs/agents/ownership-zones.md)).
2. Prefer config/seed → branding/`brand.ts` → product-first package → minimal sync-first wire.
3. Touch sync-first file → marker + `FORK_DELTA.md`.
4. Run [pr-checklist.md](docs/agents/pr-checklist.md).
5. Finish multi-step goals without stopping for “continue?”.

## Tooling

| Area | Tool |
|------|------|
| Console | `frontend/` + pnpm (`pnpm-lock.yaml`) |
| Product web | `web/` + pnpm (own lockfile) |
| Backend | Go — see `backend/go.mod` (CI **1.26.5**) |
| Edge publish | `deploy/scripts/deploy-web-static.sh`, `apply-nginx-topology.sh`, `verify-topology.sh` |
| Local three-process | [docs/LOCAL_DEV.md](docs/LOCAL_DEV.md) |
