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
- Redis-backed SSO/desktop codes: `BoxAICodeStore` in handler + adapter in `routes/boxai_code_store.go`.

## Frontends

| Surface | Path | Policy |
|---------|------|--------|
| Console | `frontend/` | Hybrid; brand via `frontend/src/constants/brand.ts` |
| Marketing + Creator | `web/` | Product-first entire tree; brand via `web/src/lib/brand.ts` |
| Desktop UI | `desktop/crates/agent-gui/` | Product-first vendored tree |

### Console (`frontend/`)

- Brand strings/logos only through `brand.ts`.
- BoxAI-only screens: dedicated views + routes (SSO, desktop-auth, download).
- Do not grow Creator/marketing product surface here; that belongs in `web/`.

### Product web (`web/`)

- Apex host UI only in `web/`.
- Never embed `web/dist` into Go.
- Publish apex via Actions **Deploy production** (`mode=web` or `full`); emergency only: `deploy/scripts/deploy-web-static.sh`.
- Edge: `deploy/nginx-you-box.com.conf`.

### Desktop (`desktop/`)

- Product edits do not need `// BOXAI:` markers.
- Auth/server integration contracts stay in monorepo backend handlers + `desktop/UPSTREAM.md`.

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
