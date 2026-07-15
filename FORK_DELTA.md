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
| Public release tag scheme | `vX.Y.Z-box.N` (GoReleaser → GHCR `boxai`) |

## Product-first paths (owned entirely by BoxAI)

| Path | Purpose |
|------|---------|
| `backend/internal/branding/` | Backend product name/tagline helpers |
| `frontend/src/constants/brand.ts` | Frontend brand constants |
| `frontend/src/styles/tokens.css` | Global design tokens (`--bx-*`, dark-first) |
| `frontend/src/styles/home-platform.css` | Homepage motion shell |
| `docs/design-unification-ledger.md` | Console ↔ homepage design unification ledger |
| `frontend/public/logo.svg` | Full-color mark |
| `frontend/public/logo-mono.svg` | Monochrome mark |
| `frontend/public/logo.png` | Raster mark |
| `docs/BRAND.md` | Brand system |
| `AGENTS.md` | Agent hard rules |
| `docs/agents/*` | Agent SOPs |
| `FORK_DELTA.md` | This inventory |
| `tools/check_compliance_hash.py` | Compliance freeze gate |
| `tools/check_migration_lint.py` | Migration naming gate |
| `tools/i18n/*` | Locale parity / ledger export tools |
| `docs/i18n/*` | i18n process, glossary, translation waves |
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
| `frontend/src/main.ts` | Document title default; default dark theme |
| `frontend/index.html` | Default title; Noto Sans SC; FOUC dark class |
| `frontend/src/style.css` | Primitives use `--bx-*` tokens |
| `frontend/tailwind.config.js` | `dark` scale + mesh/shadows aligned to homepage |
| `frontend/src/views/HomeView.vue` | Marketing surface |
| `frontend/src/components/layout/AppLayout.vue` | Console shell `bx-page` + ambient mesh |
| `frontend/src/components/layout/AppSidebar.vue` | Sidebar tokens + default dark |
| `frontend/src/components/layout/AppHeader.vue` | Header glass / token surfaces |
| `frontend/src/components/layout/TablePageLayout.vue` | Table shell uses card tokens |
| `frontend/src/components/layout/AuthLayout.vue` | Auth chrome brand + homepage ambient |
| `frontend/src/i18n/locales/{en,zh,vi}/*` | Product copy (landing/dashboard/settings/misc/batchImage + admin) |
| `frontend/src/i18n/localeMeta.ts` | Locale codes, BCP-47, compliance language map |
| `frontend/src/i18n/index.ts` | Loaders for en/zh/vi; `boxai_locale` storage (+ legacy key) |
| `frontend/src/components/auth/WechatOAuthSection.vue` | Explicit Vietnamese WeChat availability guidance |
| `frontend/src/views/admin/SettingsView.vue` | Product settings copy and documentation links support zh/en/vi |
| `frontend/src/views/admin/settings/EmailTemplateEditor.vue` | Vietnamese email-event metadata and locale-aware administration copy |
| `frontend/src/views/user/BatchImageGuideView.vue` | Vietnamese page guidance and downloadable Agent Skill instructions |
| `frontend/src/views/KeyUsageView.vue` | Locale-backed quota period abbreviations |
| `frontend/src/components/payment/PaymentProviderDialog.vue` | Locale-backed custom payment-method placeholder |
| `frontend/src/components/payment/__tests__/PaymentProviderDialog.spec.ts` | Locale-backed payment placeholder regression coverage |
| `backend/internal/service/notification_email_templates_vi.go` | Official Vietnamese email templates |
| `backend/internal/service/notification_email_service.go` | BOXAI: `vi` in locale list + normalize |
| Related views/components listed in brand rollout | Prefer import from `brand.ts` |

### Deploy / release hybrid

| Path | Intent |
|------|--------|
| `deploy/docker-compose.yml` | `BOXAI_IMAGE` parameter |
| `deploy/docker-compose.local.yml` | `BOXAI_IMAGE` parameter |
| `deploy/docker-compose.standalone.yml` | `BOXAI_IMAGE` parameter |
| `deploy/docker-deploy.sh` | Fork raw URL + product banner |
| `deploy/.env.example` | Document `BOXAI_IMAGE` pin |
| `deploy/DOCKER.md` | Public GHCR pull docs for `boxai` |
| `.goreleaser.yaml` / `.goreleaser.simple.yaml` | GHCR image name `boxai`, BoxAI release copy |
| `.github/workflows/release.yml` | BoxAI package links; VERSION keeps upstream baseline |

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
