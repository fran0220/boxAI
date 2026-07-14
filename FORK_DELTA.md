# Fork delta inventory

Enumerates intentional product differences vs upstream `Wei-Shaw/sub2api`.  
Update this file in the **same PR** as any new BOXAI marker or product-first path.

## Baseline

| Field | Value |
|-------|--------|
| Upstream remote | `https://github.com/Wei-Shaw/sub2api.git` |
| Last fully inventoried baseline | `v0.1.155` / `0.1.155` (`backend/cmd/server/VERSION`) |
| Product origin | `fran0220/boxAI` |
| Public image | `ghcr.io/fran0220/boxai` |

## Product-first paths (owned entirely by BoxAI)

| Path | Purpose |
|------|---------|
| `backend/internal/branding/` | Backend product name/tagline helpers |
| `frontend/src/constants/brand.ts` | Frontend brand constants |
| `frontend/public/logo.svg` | Full-color mark |
| `frontend/public/logo-mono.svg` | Monochrome mark |
| `frontend/public/logo.png` | Raster mark |
| `docs/BRAND.md` | Brand system |
| `AGENTS.md` | Agent hard rules |
| `docs/agents/*` | Agent SOPs |
| `FORK_DELTA.md` | This inventory |
| `tools/check_compliance_hash.py` | Compliance freeze gate |
| `tools/check_migration_lint.py` | Migration naming gate |
| `.github/workflows/fork-gates.yml` | Fork CI gates |

## Sync-first / hybrid files with BOXAI markers

Markers: search `BOXAI:` in the tree. Intentional call sites:

### Backend

| Path | Intent |
|------|--------|
| `backend/cmd/server/main.go` | Version / setup log product name |
| `backend/internal/setup/cli.go` | Install wizard banner |
| `backend/internal/service/auth_service.go` | Default site name for email flows |
| `backend/internal/service/auth_email_binding.go` | Default site name |
| `backend/internal/service/auth_oauth_email_flow.go` | Default site name |
| `backend/internal/service/user_service.go` | Default site name for notify email |
| `backend/internal/service/balance_notify_service.go` | `defaultSiteName` |
| `backend/internal/service/content_moderation.go` | Fallback site name |
| `backend/internal/service/setting_features.go` | `GetSiteName` default |
| `backend/internal/service/setting_parse.go` | Default settings site name |
| `backend/internal/service/setting_public.go` | Public settings default site name |
| `backend/internal/service/totp_service.go` | TOTP issuer |
| `backend/internal/service/payment_order.go` | Payment subject product prefix |
| `backend/internal/service/payment_order_result_test.go` | Subject assertion uses branding |

### Frontend (brand wiring; may lack `BOXAI` comments in pure TS imports)

| Path | Intent |
|------|--------|
| `frontend/src/constants/brand.ts` | Source of truth |
| `frontend/src/router/title.ts` | Title uses brand constants |
| `frontend/src/stores/app.ts` | Default site name |
| `frontend/src/main.ts` | Document title default |
| `frontend/index.html` | Default title |
| `frontend/src/views/HomeView.vue` | Marketing surface |
| `frontend/src/components/layout/AuthLayout.vue` | Auth chrome brand |
| `frontend/src/i18n/locales/{en,zh}/*` | Product copy (landing/dashboard/settings/misc) |
| Related views/components listed in brand rollout | Prefer import from `brand.ts` |

### Deploy / release hybrid

| Path | Intent |
|------|--------|
| `deploy/docker-compose.yml` | `BOXAI_IMAGE` parameter |
| `deploy/docker-compose.local.yml` | `BOXAI_IMAGE` parameter |
| `deploy/docker-compose.standalone.yml` | `BOXAI_IMAGE` parameter |
| `deploy/docker-deploy.sh` | Fork raw URL + product banner |
| `deploy/.env.example` | Document `BOXAI_IMAGE` pin |

## Frozen (must stay Sub2API wording)

| Path | Reason |
|------|--------|
| `frontend/src/stores/adminCompliance.ts` | Ack phrases byte-stable |
| `docs/legal/admin-compliance.zh.md` | Legal document |
| `docs/legal/admin-compliance.en.md` | Legal document |

Hash pins: `tools/compliance-hash.pins`.

## Explicit non-goals (do not “fix” these)

- Renaming Go module path, binary, compose service, or DB to `boxai`
- Mass-replacing Sub2API in tests that assert upstream SMTP/provider fixtures
- Shipping production on `:latest`

## How to update this file

1. Add/remove rows when markers or product-first paths change.
2. On upstream sync land: bump **Baseline** tag.
3. Prefer small, reviewable inventory edits over long prose.
