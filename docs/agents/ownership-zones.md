# Ownership zones

Default merge and edit policy by path. Unknown backend paths → **sync-first**.

## Policies

| Policy | Meaning |
|--------|---------|
| **sync-first** | Prefer upstream on conflict; local edits need `// BOXAI:` / `<!-- BOXAI -->` + `FORK_DELTA.md` |
| **product-first** | BoxAI owns the path; no upstream conflict expected |
| **hybrid** | Upstream structure/contracts; product image, URLs, brand copy |
| **frozen** | Byte-stable; CI hash / human review |

## Table

| Path / area | Policy | Edit rules | Conflict default |
|-------------|--------|------------|------------------|
| `backend/internal/{service,handler,repository}` | sync-first | No whole-file product forks; branding via `internal/branding` | **theirs**, replay BOXAI |
| `backend/ent/`, `backend/cmd/` | sync-first | Schema via ent; cmd only product display wires | theirs + replay |
| `backend/internal/branding/` | product-first | Product identity constants | — |
| `backend/internal/boxai/` | product-first | Optional product package | — |
| `backend/internal/handler/boxai_*.go` | product-first | Browser session, desktop auth, Creator key, JWT bridge | — |
| `backend/internal/server/routes/boxai_*.go` | product-first | Redis code store adapter | — |
| `backend/migrations/*` version `<900` | sync-first (read-only) | Only via upstream merge | theirs |
| `backend/migrations/9xx_boxai_*.sql` | product-first | Forward-only, idempotent; prefer `boxai_` settings keys | — |
| `web/` | product-first | React marketing + Creator; not Go-embed | — |
| `desktop/` | product-first | Vendored Tauri app; `desktop/UPSTREAM.md` | — |
| `frontend/src/constants/brand.ts`, `frontend/public/logo*` | product-first | Console brand assets | — |
| `frontend/src/views/auth/BoxAISso*.vue`, `DesktopAuthView.vue`, `public/DesktopDownloadView.vue` | product-first | BoxAI-only console routes | — |
| Other `frontend/src/` | hybrid | Brand via `brand.ts` | theirs, replay brand |
| `frontend/src/stores/adminCompliance.ts` | frozen | Legal phrases | human |
| `docs/legal/` | frozen | Compliance markdown | human |
| `docs/WEB_PLATFORM.md`, `LOCAL_DEV.md`, `OFFICE_MODULE.md`, `PRODUCTION.md`, `docs/README.md` | product-first | Product architecture docs | — |
| `deploy/nginx-you-box.com.conf`, `deploy/Caddyfile.you-box.com`, `deploy/scripts/*` | product-first | Edge topology + publish helpers | — |
| Other `deploy/` | hybrid | Env names, volumes, ports, healthchecks; pin `BOXAI_IMAGE` | structure theirs |
| `.goreleaser*.yaml`, `.github/workflows/` | hybrid | Image/URL product; build tracks upstream | structure theirs |
| `Dockerfile*` | sync-first | Labels OK; multi-stage layout; **Vue embed only** | theirs |
| `README*`, `AGENTS.md`, `docs/agents/*`, `DEV_GUIDE.md`, `FORK_DELTA.md`, `docs/BRAND.md` | product-first | Keep LICENSE / CLA / disclaimers | ours |
| `backend/cmd/server/VERSION` | sync-first | Always take upstream on merge; BoxAI uses tag `-box.N` | theirs |

## New zones

Add long-lived product packages to this table and to root `AGENTS.md` in the same PR.
