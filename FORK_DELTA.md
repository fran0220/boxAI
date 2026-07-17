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
| `desktop/` | Vendored BoxAI Desktop (Tauri app + gateway + WebUI); provenance in `desktop/UPSTREAM.md` |
| `frontend/src/views/auth/DesktopAuthView.vue` | BoxAI Desktop browser-login handshake page (mints PKCE code, redirects to desktop scheme) |
| `frontend/src/views/public/DesktopDownloadView.vue` | Public desktop download page (lists newest `desktop-v*` GitHub release assets) |
| `frontend/src/utils/safeReturnPath.ts` | Safe relative post-auth return paths (console) |
| `.github/workflows/desktop-release.yml` | Desktop release workflow (monorepo adaptation of `desktop/.github/workflows/desktop-release.yml`; `desktop-v*` tags, never marks releases "latest") |
| `backend/internal/handler/boxai_desktop_gateway_auth.go` | Desktop JWT-as-credential gateway auth bridge (new BOXAI file in sync-first pkg; needs AuthHandler services) |
| `backend/internal/handler/boxai_desktop_gateway_auth_test.go` | Unit tests for the JWT→API-key gateway bridge |
| `backend/internal/handler/boxai_desktop_auth.go` | Desktop OAuth (PKCE) browser-login endpoints (authorize + token exchange) |
| `backend/internal/handler/boxai_desktop_auth_test.go` | Unit tests for the desktop OAuth PKCE helpers |
| `backend/internal/handler/boxai_code_store.go` | BoxAICodeStore interface (depguard-safe code store) |
| `backend/internal/server/routes/boxai_code_store.go` | Redis adapter for BoxAICodeStore |
| `backend/internal/handler/boxai_browser_session.go` | Host-only HttpOnly browser-session boundary, CSRF/origin enforcement, and OAuth browser response adapter (relative FrontendRedirectURL works on apex + console) |
| `backend/internal/handler/boxai_browser_session_test.go` | Cookie, host/origin, browser OAuth response, apex relative-callback session, and credential-leak regression tests |
| `backend/internal/handler/boxai_registration.go` | Console-only opaque email-registration prepare/complete transaction handlers |
| `backend/internal/handler/boxai_registration_test.go` | Registration transaction validation, retry, consumption, and response tests |
| `backend/internal/handler/boxai_creator_key.go` | Idempotent `boxai-creator` API key ensure endpoint |
| `backend/internal/handler/boxai_creator_key_test.go` | Unit tests for Creator ensure-key |
| `backend/internal/handler/boxai_public_status.go` | Public unauthenticated system status API + admin public_visible toggle |
| `backend/internal/handler/boxai_public_status_test.go` | Public status period/ETag/secret-leak unit tests |
| `backend/migrations/900_boxai_channel_monitor_public_visible.sql` | `public_visible` column for marketing status |
| `docs/status-surface.md` | Shared status surface design conventions (check-cx language, teal brand) |
| `web/` | React marketing + Creator + **customer shell** SPA (Vite + TS + Tailwind); static dist on apex (not Go-embed) |
| `docs/WEB_PLATFORM.md` | Host topology, customer shell, admin console, env flags |
| `docs/CUSTOMER_SHELL_UNIFICATION.md` | Customer shell **shipped** ledger; residual → `docs/agents/next-actions.md` |
| `web/src/lib/customer-api.ts` | Apex customer-center JSON API client |
| `web/src/pages/account/*` | Customer account center (keys, usage, profile, security/2FA, orders, channels, monitor, batch-image, announcements, …) |
| `frontend/src/views/public/ApexCustomerRedirect.vue` | Console stub for removed customer pages → apex |
| `frontend/src/utils/apexOrigin.ts` | Console→apex path map; non-admin redirect; admin-first console |
| `web/src/pages/auth/Login.tsx` (and Signup/Forgot/Reset) | Apex credential forms (password + registration transaction) |
| `web/src/pages/Checkout.tsx` | Apex checkout (Stripe/QR/Airwallex; WeChat MP → console) |
| `web/src/pages/DesktopAuth.tsx` | Apex Desktop PKCE authorize page |
| `backend/internal/handler/boxai_auth_tx.go` | Auth Transaction types/helpers (flag `BOXAI_AUTH_TX`, dark) |
| `docs/LOCAL_DEV.md` | Local three-process developer guide |
| `docs/OFFICE_MODULE.md` | Desktop module + web URL map |
| `deploy/Caddyfile.you-box.com` | 3-host Caddy (apex / console / api) |
| `deploy/nginx-you-box.com.conf` | Live production nginx multi-host topology |
| `deploy/scripts/deploy-web-static.sh` | Build+rsync React to production docroot |
| `deploy/scripts/apply-nginx-topology.sh` | Install nginx topology + certbot expand |
| `deploy/scripts/verify-topology.sh` | HTTP topology smoke checks |
| `backend/internal/branding/` | Backend product name/tagline helpers |
| `frontend/src/constants/brand.ts` | Frontend brand constants |
| `frontend/src/styles/tokens.css` | Global design tokens (`--bx-*`, dark-first) |
| `frontend/src/styles/home-platform.css` | Homepage motion shell |
| `docs/design-unification-ledger.md` | Console ↔ homepage design unification ledger |
| `frontend/public/logo.svg` | Full-color mark |
| `frontend/public/logo-mono.svg` | Monochrome mark |
| `frontend/public/logo.png` | Raster mark |
| `docs/BRAND.md` | Brand system |
| `docs/PRODUCTION.md` | Production topology ops (product overlay) |
| `DEV_GUIDE.md` | Local + multi-surface developer guide |
| `docs/agents/next-actions.md` | Post customer-shell optimization backlog for agents |
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
| `backend/internal/service/auth_service.go` | Default site name; browser JWT scope claim; server-only prepared bcrypt registration path |
| `backend/internal/service/boxai_browser_session.go` | Audience-scoped access JWT issuance and refresh-cache-backed host-bound browser sessions |
| `backend/internal/service/refresh_token_cache.go` | Browser surface binding and optional atomic refresh-token consumption contract |
| `backend/internal/repository/refresh_token_cache.go` | Redis `GETDEL` implementation for single-winner legacy adoption |
| `backend/internal/service/email_service.go` | Password-reset credentials delivered in URL fragments, not query strings |
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
| `backend/internal/server/routes/gateway.go` | BOXAI: desktop JWT-as-credential middleware wired before `apiKeyAuth` on `/v1` (flag `BOXAI_DESKTOP_JWT_GATEWAY`, default-on) |
| `backend/internal/server/routes/auth.go` | BOXAI: browser session + opaque registration + desktop OAuth (PKCE) + public status routes (rate-limited) |
| `backend/internal/server/routes/admin.go` | BOXAI: channel-monitor public_visible admin routes |
| `backend/internal/handler/handler.go` | BOXAI: PublicStatus handler field |
| `backend/internal/handler/wire.go` | BOXAI: ProvideBoxAIPublicStatusHandler wire set |
| `backend/cmd/server/wire_gen.go` | BOXAI: public status handler injection |
| `backend/internal/service/channel_monitor_aggregator.go` | BOXAI: `BatchPrimaryAvailabilityPct` for public multi-window list (no N+1) |
| `frontend/src/api/admin/channelMonitor.ts` | BOXAI: `setPublicVisible` / `batchPublicVisible` admin helpers |
| `frontend/src/views/admin/ChannelMonitorView.vue` | BOXAI: public_visible column + toggle |
| `backend/internal/server/middleware/jwt_auth.go` | Host/audience boundary for browser access JWTs; legacy audience-less JWT compatibility |
| `backend/internal/server/middleware/admin_auth.go` | Console audience plus explicit admin scope required for browser admin JWTs |
| `backend/internal/server/middleware/cors.go` | Browser-session opt-in and fixed CSRF request headers |
| `backend/internal/handler/auth_handler.go` | Centralized cookie-mode login/register response with no browser refresh-token exposure |
| `backend/internal/handler/auth_email_oauth.go` | Email-provider OAuth completion uses the centralized browser-session response |
| `backend/internal/handler/auth_linuxdo_oauth.go` | Direct console callback cookie issuance and clean completion fragment |
| `backend/internal/handler/auth_oauth_pending_flow.go` | Browser-safe pending OAuth exchange and centralized session issuance |
| `backend/internal/handler/auth_oidc_oauth.go` | OIDC completion uses the centralized browser-session response |
| `backend/internal/handler/auth_wechat_oauth.go` | WeChat completion uses the centralized browser-session response |
| `backend/internal/handler/auth_dingtalk_oauth.go` | DingTalk completion uses the centralized browser-session response |
| `backend/internal/server/routes/user.go` | BOXAI: `POST /boxai/creator/ensure-key` (apiKeyService arg) |
| `backend/internal/server/router.go` | BOXAI: pass apiKeyService into RegisterUserRoutes |
| `backend/internal/handler/boxai_desktop_gateway_auth.go` | BOXAI: prefer API key named `boxai-creator` in JWT bridge |

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
| `frontend/src/views/HomeView.vue` | Console-host home / admin `home_content` shell |
| `frontend/src/components/layout/AppLayout.vue` | Console shell `bx-page` + ambient mesh |
| `frontend/src/components/layout/AppSidebar.vue` | Sidebar tokens + default dark |
| `frontend/src/components/layout/AppHeader.vue` | Header glass / token surfaces |
| `frontend/src/components/layout/TablePageLayout.vue` | Table shell uses card tokens |
| `frontend/src/components/layout/AuthLayout.vue` | Auth chrome brand + homepage ambient |
| `frontend/src/i18n/locales/{en,zh,vi}/*` | Product copy (landing/dashboard/settings/misc/batchImage + admin) |
| `frontend/src/i18n/localeMeta.ts` | Locale codes, BCP-47, compliance language map |
| `frontend/src/i18n/index.ts` | Loaders for en/zh/vi; `boxai_locale` storage |
| `frontend/src/components/auth/WechatOAuthSection.vue` | Explicit Vietnamese WeChat availability guidance |
| `frontend/src/auth/browserSession.ts` | Console in-memory access-token owner, cookie bootstrap/adoption, expiry refresh, and cross-tab coordination |
| `frontend/src/auth/finalizeOAuth.ts` | Centralized OAuth browser-session completion/adoption adapter |
| `frontend/src/auth/registrationDraft.ts` | Sensitive in-memory OAuth draft plus safe opaque registration-transaction recovery metadata |
| `frontend/src/api/auth.ts` | BOXAI: memory-only browser auth, opaque registration, desktop login helpers |
| `frontend/src/api/client.ts` | In-memory bearer injection plus one cookie-bootstrap retry on 401 |
| `frontend/src/router/index.ts` | BOXAI: `/desktop-auth`, `/download/desktop`; non-admin customer routes → apex |
| `frontend/src/stores/auth.ts` | BOXAI: Pinia view over the centralized in-memory browser session; no persisted JWT pair |
| `frontend/src/views/auth/LoginView.vue` | BOXAI: register/login redirect for admin + WeChat payment exception |
| `frontend/src/views/auth/RegisterView.vue` | BOXAI: direct-register success honors safe `?redirect=` |
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
