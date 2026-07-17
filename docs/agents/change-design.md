# Change design

Design every change so the next upstream release-tag merge stays mechanical.

## Backend

### Prefer

1. **Settings / seed** — `9xx_boxai_*.sql` or admin settings over hard-coded product strings.
2. **`backend/internal/branding`** — compile-time product identity; sync-first files reference it with `// BOXAI:`.
3. **Product-first packages** — `handler/boxai_*.go`, optional `internal/boxai/`; register with minimal route wiring.

### Stable contracts

| Contract | Value |
|----------|--------|
| Go module | `github.com/Wei-Shaw/sub2api` |
| Binary | `sub2api` |
| Embed path | `backend/internal/web/dist` (Vue console) |
| Health | `/health` |
| Env names | `deploy/.env.example` set |
| DB name/role | `sub2api` |
| Public API shapes | Match upstream unless flagged + documented |

### Migrations

- Versions `<900`: never edit after ship.
- BoxAI: `9xx_boxai_<slug>.sql` only, forward-only, idempotent.
- New settings keys: prefer `boxai_` prefix.

### Handler layering

- Handlers must not import `redis` or `repository` (depguard).
- Redis-backed **desktop PKCE** (and similar) codes: `BoxAICodeStore` in handler + adapter in `routes/boxai_code_store.go`.
- Browser sessions: host-only cookies per UI host; short memory JWT; no parent-domain cookie.
- **Do not** re-add Web SSO code exchange between apex and console.

## Frontends

| Surface | Path | Policy |
|---------|------|--------|
| **Customer shell** | `web/` | Product-first; brand via `web/src/lib/brand.ts` |
| **Admin console** | `frontend/` | Hybrid; brand via `frontend/src/constants/brand.ts` |
| Desktop UI | `desktop/crates/agent-gui/` | Product-first vendored tree |

### Customer shell (`web/`)

- All **normal-user** UX: marketing, Creator, login/register/OAuth callback, account center, checkout, status, desktop-auth.
- Same-origin session on apex; edge allowlist for customer + auth APIs only.
- Never embed `web/dist` into Go.
- Publish with `deploy/scripts/deploy-web-static.sh`.
- Edge: `deploy/nginx-you-box.com.conf` / `Caddyfile.you-box.com`.

### Admin console (`frontend/`)

- Brand strings/logos only through `brand.ts`.
- **Admin** product surface: users, channels, pricing, ops, risk, compliance, settings.
- BoxAI bridges: `DesktopAuthView`, `ApexCustomerRedirect`, download page.
- **WeChat MP payment exception:** keep `Payment*.vue` / Stripe / Airwallex until product drops in-WeChat console re-login.
- Do **not** grow Creator/marketing/**customer account** surface here; that belongs in `web/`.
- Non-admin routes should redirect to apex (`frontend/src/utils/apexOrigin.ts`), not rebuild dual shells.

### Desktop (`desktop/`)

- Product edits do not need `// BOXAI:` markers.
- Auth/server integration contracts stay in monorepo backend handlers + `desktop/UPSTREAM.md`.
- Prefer apex `/desktop-auth` for new client defaults; console path may remain for old builds.

## Compliance

`adminCompliance` phrases and `docs/legal/*` keep **Sub2API** legal wording. Changing them invalidates stored acks and requires hash pin updates. Product UI uses **BoxAI**.

## Markers

```go
// BOXAI: product default
siteName := branding.ProductName
```

```vue
<!-- BOXAI: brand wordmark -->
```

Add or change a marker → update `FORK_DELTA.md` in the same commit.
