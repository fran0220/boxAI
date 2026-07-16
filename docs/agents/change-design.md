# Change design standard

Design every change so the next upstream tag merge is mechanical.

## Backend (strict)

### Prefer configuration over code

1. **Seed / admin settings first** — site name, logo, homepage, and many defaults are already runtime-configurable. Prefer a `9xx_boxai_*.sql` seed over hard-coding.
2. **Central constants second** — compile-time product identity lives in `backend/internal/branding`. Upstream-owned files should only reference `branding.ProductName` (etc.) with a `// BOXAI:` marker.
3. **New product features third** — new packages under product-first paths; register routes/handlers with minimal wiring; API surface under `/api/boxai/...` (or a dedicated group) when the contract is BoxAI-only.

### Contracts you must not break

| Contract | Keep stable |
|----------|-------------|
| Go module path | `github.com/Wei-Shaw/sub2api` |
| Binary name | `sub2api` |
| Embed path | `backend/internal/web/dist` |
| Health | `/health` |
| Env var names | full deploy set (see `deploy/.env.example`) |
| DB role/db name | `sub2api` (invisible to end users) |
| Upstream public API shapes | defaults must match upstream behavior |

### Migrations

- Upstream files: never edit after they ship.
- BoxAI files: `9xx_boxai_<slug>.sql` only.
- Settings keys introduced by BoxAI: prefer `boxai_` prefix.
- `_notx` files: only for concurrent/idempotent index patterns already used upstream.

## Frontend (dual surface)

| Surface | Path | Notes |
|---------|------|--------|
| Console (Vue) | `frontend/` | Hybrid with upstream; brand via `frontend/src/constants/brand.ts` |
| Marketing + Creator (React) | `web/` | **Product-first entire tree**; brand via `web/src/lib/brand.ts` |
| Desktop UI | `desktop/crates/agent-gui/` | Product-first vendored tree |

### Console (Vue)

- Product strings and logo paths: only via `frontend/src/constants/brand.ts`.
- Do not rewrite shared upstream components for brand-only needs; compose or wrap.
- BoxAI-only screens: dedicated view files + router entries (`BoxAISso*`, public download).
- i18n brand keys: list in `FORK_DELTA.md` if they touch upstream locale files.
- Tests: assert against brand constants, not raw `"BoxAI"` where practical.

### Product web (React)

- New product UI for apex host belongs in `web/`, not by forking large Vue console trees.
- Do **not** embed `web/dist` into the Go binary (keeps Dockerfile/upstream embed path stable).
- Ship with `deploy/scripts/deploy-web-static.sh`; edge config under `deploy/nginx-you-box.com.conf`.

## Compliance exception

`adminCompliance` phrases and `docs/legal/*` intentionally retain **Sub2API** legal wording. Changing them invalidates stored acknowledgements. Product UI everywhere else uses **BoxAI**.

## Markers

```go
// BOXAI: default product name
siteName := branding.ProductName
```

```vue
<!-- BOXAI: brand wordmark -->
```

When you add a marker, update `FORK_DELTA.md` in the same commit/PR.
