# Customer Shell Unification

**Status:** in progress  
**Oracle:** approve-with-changes (2026-07-17)  
**Goal:** one customer domain, one customer frontend, one customer session; Vue console admin-only.

## End state

| Surface | Role | Credential |
|---------|------|------------|
| `you-box.com` React | All normal-user UX | `__Host-boxai_session` (web) + memory access JWT |
| `console.you-box.com` Vue | Admin only | `__Host-boxai_session` (console, admin-only) |
| Desktop | Client app | OAuth PKCE |
| `api.you-box.com` | Developer API | API Key only (no browser cookie) |

Invariants:

- No parent-domain cookie (`Domain=.you-box.com`)
- No Web SSO for customer journeys after cutover
- No cookie-BFF for all `/api/*` (keep short memory JWT + CSRF headers)
- Apex never proxies `/api/v1/admin/*` or setup
- Auth next_action driven by backend (Auth Transaction); React renders steps
- After login, return to original intent (`return_to`), not Dashboard by default

## Rejected alternatives

| Option | Why not |
|--------|---------|
| Vue at `you-box.com/console` | Shares Origin with Creator; weakens admin/customer isolation |
| `auth.you-box.com` + OIDC | Still two customer shells + third service |
| Parent-domain cookie | Breaks `__Host-`, spreads cookie to api subdomain |

## Phases (Oracle-revised)

| # | Phase | Notes |
|---|-------|-------|
| 0 | Freeze SSO *extensions* | Keep SSO as rollback bridge until Phase 6 |
| 1 | Edge allowlist restructure + surface JWT verify | Unblocks customer APIs on apex |
| 2 | Customer pages → React (keys, usage, profile, subs, redeem, orders) | Highest value first |
| 3 | Purchase on React (Stripe/QR/Airwallex; WeChat MP stays console v1) | |
| 3∥ | Auth Transaction backend (dark) | Parallel with 2–3 |
| 4 | Auth UI on React (password/email first, then OAuth dual URI) | |
| 5 | Desktop-auth on apex | Keep console URL for old clients |
| 6 | Adminize console + delete Web SSO | |
| 7 | Cleanup legacy | |

## Non-goals (v1)

- Token unification across surfaces
- Cookie-BFF for all APIs
- External IdP
- WeChat MP in-WeChat purchase on apex
- BatchImage / AvailableChannels / CustomPage ports
- Admin UI rewrite
- Immediate deletion of Vue user views (keep dark for rollback ≥1 release)

## PR Plan

### PR 1: Edge allowlist restructure + customer API surface

- **Files:** `deploy/nginx-you-box.com.conf`, `deploy/Caddyfile.you-box.com`, `deploy/scripts/verify-topology.sh`, `docs/WEB_PLATFORM.md`
- **Dependencies:** None
- **Description:** Explicit per-prefix apex proxy locations for customer APIs; deny admin/setup; verify web-audience JWT is accepted on same-host customer routes (middleware already host-gates audience).

### PR 2: React account shell + Keys + Usage

- **Files:** `web/src/pages/account/*`, `web/src/lib/customer-api.ts`, `web/src/App.tsx`, i18n
- **Dependencies:** PR 1
- **Description:** `/account`, `/account/keys`, `/account/usage` with full CRUD/list against existing JSON APIs.

### PR 3: Profile, Security, Subscriptions, Redeem, Orders, Affiliate

- **Files:** `web/src/pages/account/*`, nav/footer links
- **Dependencies:** PR 2
- **Description:** Remaining customer-center pages; console deep links replaced for these routes.

### PR 4: Purchase v1 on apex

- **Files:** `web/src/pages/checkout/*`, `/payment/result`, Pricing CTA, CSP if needed
- **Dependencies:** PR 1, PR 3
- **Description:** Stripe redirect + QR polling + Airwallex hosted; WeChat browser → temporary console deep link.

### PR 5: Auth Transaction backend (dark)

- **Files:** `backend/internal/handler/boxai_auth_tx.go`, routes, Redis store, flag `BOXAI_AUTH_TX`
- **Dependencies:** None (parallel)
- **Description:** Opaque transaction_id + `next_action` envelope; wraps existing registration/2FA/OAuth completion without breaking Vue.

### PR 6: Auth UI password/email on apex

- **Files:** `web/src/pages/auth/*`, edge allowlist for login/register/forgot/reset, `return_to`
- **Dependencies:** PR 5 (preferred) or existing login + browser session headers
- **Description:** Feature-flagged forms on apex; SSO AuthRedirect remains fallback until flag on.

### PR 7: OAuth dual redirect URIs

- **Files:** browser session OAuth redirect for web surface, React OAuth callback pages
- **Dependencies:** PR 6
- **Description:** Register apex callbacks at providers; dual-host during transition.

### PR 8: Desktop-auth on apex

- **Files:** `web/src/pages/DesktopAuth.tsx`, desktop default URL bump later
- **Dependencies:** PR 6
- **Description:** `you-box.com/desktop-auth`; console page retained.

### PR 9: CTA flip + console user-route redirects

- **Files:** React links, Vue router guards → apex
- **Dependencies:** PR 4, PR 7
- **Description:** Flagged redirects; rollback = flag off.

### PR 10: Adminize console + delete Web SSO

- **Files:** delete SSO handlers/pages, docs rewrite, console nav
- **Dependencies:** PR 9 soak + PR 8
- **Description:** Console session admin-only; remove `BOXAI_WEB_SSO`.

### PR 11: Cleanup

- **Files:** dead Vue user views (after window), FORK_DELTA, legacy adoption
- **Dependencies:** PR 10 + soak

## Verification

- Apex: customer paths → 401 not 404; admin/setup → 404
- API host: no browser session
- Login → return_to checkout/keys/create
- Payment: create → provider → apex `/payment/result`
- No cross-host token leakage
