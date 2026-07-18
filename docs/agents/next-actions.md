# Next optimization actions (post customer-shell)

**Status:** active backlog after customer-shell unification + OAuth quality work.  
**Oracle review (2026-07-17):** admin platform features are **not** hard-migration targets; stop dual-shell thinking.  
**Last doc refresh:** 2026-07-17 (backlog execution pass).

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
- [x] **P1-1** WeChat MP exception **KEEP** (permanent) — documented in WEB_PLATFORM / PAYMENT / this file
- [x] **P1-2** Customer OAuth providers from public settings — Google only in prod (2026-07-17); Login hides others via settings flags
- [x] **P2-1** Desktop default browser auth → apex `https://you-box.com/desktop-auth` (api/console hosts remapped; console path kept for old clients)
- [x] **P2-2** Go `LegacyBrowserAdoptionEnabled` process default **off** when env unset (`envDefaultOff`)
- [x] golangci cleanups on public status handler (gofmt / errcheck / SA4000) blocking CI

## Execution order (recommended)

```
P0 ops (prod correctness)
  → P1 product decisions (WeChat volume, which OAuth providers)
    → P2 engineering polish (desktop default URL, stub removal, optional payments UI)
```

## Do next (prioritized)

### P0 — Ops / production hygiene

| ID | Action | Status | Notes |
|----|--------|--------|-------|
| P0-1 | Confirm prod OAuth provider **redirect_uri** includes apex (or dual-register console + apex) | **Residual (ops IdP) + code gate** | Prod: only **Google** enabled; backend callback still **console**. Apex Login/Profile **hide** Google when `google_oauth_redirect_url` host ≠ current host (public settings field; state cookies are host-bound). **Ops:** dual-register apex callback in Google Cloud Console, set `google_oauth_redirect_url` to `https://you-box.com/api/v1/auth/oauth/google/callback`, redeploy backend image with public field, then Google reappears on apex. |
| P0-2 | Confirm prod `BOXAI_LEGACY_BROWSER_ADOPTION=false` after adopt drain | **Residual** | Prod still has `=true`. ~3 successful `session/adopt` in 72h (not fully drained). Keep `true` until quiet; then set false + restart. Compose on server image still defaulted true — align with repo `false` on next env edit. |
| P0-3 | Deploy edge allowlist + `deploy-web-static.sh` after web releases | **Done (2026-07-17)** | Applied `deploy/nginx-you-box.com.conf`, deployed `web/dist`, `verify-topology.sh` **VERIFY PASSED** (oauth/login/customer APIs, SSO removed, admin blocked). |

### P1 — Product decisions (data, not code-first)

| ID | Action | Decision | Status |
|----|--------|----------|--------|
| P1-1 | **WeChat MP volume** last 60–90d | **KEEP exception** forever for now | Done — `payment_orders` empty last 90d (and ever), but payment may re-enable; exception stays. Never turn on `BOXAI_CONSOLE_ADMIN_SESSION_ONLY` without dropping exception. |
| P1-2 | Which OAuth providers are **customer-enabled** in prod | **Google only** (2026-07-17) | Done — password + Google. UI already hides disabled providers via `parseOAuthLoginFlags` / settings.public |

### P2 — Engineering

| ID | Action | Status | Notes |
|----|--------|--------|-------|
| P2-1 | Desktop default browser URL → apex `/desktop-auth` | **Done** | `resolveDesktopBrowserAuthOrigin`; default server `https://api.you-box.com` |
| P2-2 | Flip Go `LegacyBrowserAdoptionEnabled` process default off | **Done** | `envDefaultOff`; tests updated |
| P2-3 | Remove `ApexCustomerRedirect` stubs after ≥1–2 releases | **Deferred** | Deep-link compatibility; leave stubs until ≥1–2 releases after customer-shell ship |
| P2-4 | Stripe Elements / Airwallex embed on apex | **Skipped** | Needs conversion data; not migration |
| P2-5 | Apex pending-OAuth **registration** chooser | **Parked** | Multi-step stays Vue; apex shows error + email signup CTA only |

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
5. Ship the reviewed commit via Actions Deploy production; never assume a Docker image or public Release updates apex.
