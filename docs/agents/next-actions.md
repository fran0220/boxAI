# Next optimization actions (post customer-shell)

**Status:** active backlog after customer-shell unification + OAuth quality work.  
**Oracle review (2026-07-17):** admin platform features are **not** hard-migration targets; stop dual-shell thinking.  
**Last doc refresh:** 2026-07-17.

Canonical architecture: [WEB_PLATFORM.md](../WEB_PLATFORM.md) · History: [CUSTOMER_SHELL_UNIFICATION.md](../CUSTOMER_SHELL_UNIFICATION.md).

## Current product truth (do not re-litigate)

| Surface | Role |
|---------|------|
| `you-box.com` (`web/`) | **Only** customer shell: marketing, Creator, auth, account, checkout, status |
| `console.you-box.com` (`frontend/`) | **Admin** + WeChat MP payment exception |
| `api.you-box.com` | API Key gateway; no browser session cookie |
| Session | Host-only cookie per UI host; memory JWT; **no** Web SSO; **no** parent-domain cookie |

## Done (do not re-open as “migration”)

- [x] Apex React customer shell (account, auth, checkout, Creator, status)
- [x] Web SSO removed
- [x] Console non-admin redirect to apex; user nav hidden when redirect on
- [x] Vue non-payment customer views removed / stubbed
- [x] Apex OAuth login buttons + pending exchange completion (existing user + bind adoption-only)
- [x] WeChat MP: console payment exception (no SSO)
- [x] Compose/example `BOXAI_LEGACY_BROWSER_ADOPTION` prefer `false`
- [x] Agent docs (`AGENTS.md`, `docs/agents/*`) reflect customer shell

## Execution order (recommended)

```
P0 ops (prod correctness)
  → P1 product decisions (WeChat volume, which OAuth providers)
    → P2 engineering polish (desktop default URL, stub removal, optional payments UI)
```

Merge/open code PRs (**#4** quality OAuth, **#5** docs) before or with P0 deploys so edge allowlist + static match code.

## Do next (prioritized)

### P0 — Ops / production hygiene

| ID | Action | Owner signal | Done when |
|----|--------|--------------|-----------|
| P0-1 | Confirm prod OAuth provider **redirect_uri** includes apex (or dual-register console + apex) | Ops | OAuth login/bind works on `you-box.com` end-to-end |
| P0-2 | Confirm prod `BOXAI_LEGACY_BROWSER_ADOPTION=false` after adopt drain | Ops | No adoption traffic; env explicit in `/opt/boxAI/.env` |
| P0-3 | Deploy edge allowlist (oauth + customer APIs) + `deploy-web-static.sh` after web releases | Ops | `verify-topology.sh` green on live hosts |

### P1 — Product decisions (data, not code-first)

| ID | Action | Decision needed | Outcomes |
|----|--------|-----------------|----------|
| P1-1 | **WeChat MP volume** last 60–90d | Keep exception vs delete | **Keep:** document forever; never turn on `BOXAI_CONSOLE_ADMIN_SESSION_ONLY` without dropping exception. **Delete:** remove Checkout detour, `CONSOLE_PAYMENT_EXCEPTION_*`, Vue `payment*`, optionally `BOXAI_CONSOLE_ADMIN_SESSION_ONLY=1` |
| P1-2 | Which OAuth providers are **customer-enabled** in prod | Marketing / ops | If none: document “password-only customer login” and hide unused buttons via settings only |

### P2 — Engineering (only after P0/P1)

| ID | Action | Notes |
|----|--------|-------|
| P2-1 | Desktop default browser URL → apex `/desktop-auth` | On next Desktop release; keep console path for old builds |
| P2-2 | Flip Go `LegacyBrowserAdoptionEnabled` process default off | Only if all deploys set env explicitly |
| P2-3 | Remove `ApexCustomerRedirect` stubs after ≥1–2 releases | Deep-link compatibility |
| P2-4 | Stripe Elements / Airwallex embed on apex | Only with conversion data; not “migration” |
| P2-5 | Apex pending-OAuth **registration** chooser (invite/create/bind UI) | Only if new OAuth signups on apex matter; do **not** rewrite sync-first pending machine wholesale |

## Explicit non-goals (next month+)

| Do not | Why |
|--------|-----|
| Migrate admin channels/users/ops/risk/compliance to React | Admin trust boundary + Origin isolation |
| Rebuild dual customer shell or Web SSO | Product decision closed |
| Enable `BOXAI_AUTH_TX` for customers | Password/2FA + OAuth exchange already work |
| Pixel-parity Vue Keys/Usage tables | Action parity only |
| Parent-domain cookie / auth.you-box.com IdP | Rejected alternatives |
| Full rewrite of OAuth pending handlers as “unification” | Soft-fork cost |

## Agent checklist before starting “optimization”

1. Is this **customer** UX or **admin** ops? Admin → `frontend/`; customer → `web/`.
2. Does it revive SSO / dual shell / parent-domain cookie? → Stop.
3. Prefer IDs from this file in PR description when closing backlog items.
4. Touch sync-first paths → `// BOXAI:` + [FORK_DELTA.md](../../FORK_DELTA.md).
5. Ship `web/` via `deploy-web-static.sh`; never assume Docker image alone updates apex.
