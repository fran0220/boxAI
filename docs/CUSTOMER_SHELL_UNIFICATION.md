# Customer Shell Unification

**Status:** **shipped on main** (architecture complete; residual = ops + optional polish)  
**Oracle:** approve-with-changes (plan) + residual review (2026-07-17)  
**Goal:** one customer domain, one customer frontend, one customer session; Vue console admin-first.

## End state (current)

| Surface | Role | Credential |
|---------|------|------------|
| `you-box.com` React | All normal-user UX | `__Host-boxai_session` (web) + memory access JWT |
| `console.you-box.com` Vue | Admin-first (+ WeChat MP payment exception) | Console host cookie |
| Desktop | Client app | OAuth PKCE |
| `api.you-box.com` | Developer API | API Key only (no browser cookie) |

Invariants:

- No parent-domain cookie (`Domain=.you-box.com`)
- **No Web SSO**
- No cookie-BFF for all `/api/*` (short memory JWT + CSRF headers)
- Apex never proxies `/api/v1/admin/*` or setup
- After login, prefer `return_to` intent (not generic Dashboard)
- Admin platform features stay on Vue; not a hard-migration target

## Shipped phases (history)

| # | Phase | Status |
|---|-------|--------|
| 0 | Freeze SSO extensions | Done → SSO deleted |
| 1 | Edge allowlist + surface JWT | Done |
| 2–3 | Customer pages + checkout on React | Done |
| 4 | Auth UI + OAuth on apex | Done (pending registration chooser parked) |
| 5 | Desktop-auth on apex | Done (console URL retained for old clients) |
| 6 | Adminize console + delete Web SSO | Done |
| 7 | Cleanup / quality | Ongoing → [next-actions.md](./agents/next-actions.md) |

## Non-goals (still valid)

- Token unification across surfaces
- Cookie-BFF for all APIs
- External IdP as prerequisite
- Pixel-parity admin or Vue tables on React
- Migrating admin ops into `web/`

## Migrated customer routes (apex)

| Apex | Was console |
|------|-------------|
| `/account` | `/dashboard` |
| `/account/keys` | `/keys` |
| `/account/usage` | `/usage` |
| `/account/profile` · `/security` | `/profile` |
| `/account/subscription` | `/subscriptions` |
| `/account/orders` | `/orders` |
| `/account/redeem` · `/affiliate` | same |
| `/account/channels` · `/monitor` | `/available-channels` · `/monitor` |
| `/checkout` · `/payment/result` | `/purchase` · payment result |
| `/login` · `/signup` · OAuth callbacks | (was console identity host; now apex) |
| `/desktop-auth` | console desktop-auth |

## Exception (intentional)

**WeChat in-WeChat MP payment** may still use console `/purchase` + `/payment/*` (callback domain). Users re-login on console once — **no SSO**. Removal is a **product/data decision**, not unfinished migration. See [next-actions.md](./agents/next-actions.md) P1-1.

## Next work

Track in **[docs/agents/next-actions.md](./agents/next-actions.md)** (P0 ops, P1 product decisions, P2 optional engineering). Do not re-open dual-shell design unless product explicitly reverses course.
