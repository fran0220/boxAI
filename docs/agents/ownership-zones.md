# Ownership zones

Every path in this monorepo has a default merge and edit policy. When in doubt, treat unknown backend paths as **sync-first**.

## Legend

| Policy | Meaning |
|--------|---------|
| **sync-first** | Prefer upstream on conflict; local edits only with `// BOXAI:` + `FORK_DELTA.md` |
| **product-first** | BoxAI owns the path; upstream should not touch it |
| **hybrid** | Structure/env contracts follow upstream; product renames/URLs stay local |
| **frozen** | Byte-stable; CI hash / human review only |

## Table

| Path / area | Policy | Edit rules | Conflict default |
|-------------|--------|------------|------------------|
| `backend/internal/{service,handler,repository}` | sync-first | No feature forks of whole files; branding via `internal/branding` | **theirs** (upstream), replay BOXAI lines |
| `backend/ent/`, `backend/cmd/` | sync-first | Schema via normal ent flow; cmd only product display wires | theirs + replay |
| `backend/internal/branding/` | product-first | Only BoxAI identity constants | no conflict expected |
| `backend/internal/boxai/` (future) | product-first | Product features, own handlers/routes | no conflict expected |
| `backend/migrations/*` with version `<900` | sync-first (read-only) | Enter only via upstream merge | theirs |
| `backend/migrations/9xx_boxai_*.sql` | product-first | Idempotent, forward-only; settings keys prefer `boxai_` prefix | no conflict expected |
| `frontend/src/constants/brand.ts` | product-first | Single source for product name/tagline/logo paths | no conflict expected |
| `frontend/public/logo*` | product-first | Brand assets | no conflict expected |
| Other `frontend/src/` | hybrid (product-leaning) | Import brand constants; BoxAI-only pages in dedicated views/routes | theirs, replay brand keys |
| `frontend/src/stores/adminCompliance.ts` | frozen | Do not change legal phrases | human decision |
| `docs/legal/` | frozen | Do not change compliance markdown casually | human decision |
| `deploy/` | hybrid | Keep env names, volumes, ports, healthchecks; parameterize image + download URL | structure theirs, names ours |
| `.goreleaser*.yaml`, `.github/workflows/` | hybrid | Image templates / brand copy may differ; build logic tracks upstream | structure theirs, names ours |
| `Dockerfile`, `Dockerfile.goreleaser`, `deploy/Dockerfile` | sync-first | Extra labels OK; do not break multi-stage layout | theirs |
| `README*`, `docs/BRAND.md`, `AGENTS.md`, `docs/agents/`, `DEV_GUIDE.md`, `FORK_DELTA.md` | product-first | Keep LICENSE, CLA, and legal disclaimers | ours, manually port new upstream sections |
| `backend/cmd/server/VERSION` | sync-first | Always take upstream on merge; BoxAI release uses tag suffix `-box.N` | theirs |

## Adding a new zone

If you introduce a long-lived product package (e.g. `backend/internal/boxai/`), add it to this table and to `AGENTS.md` in the same PR.
