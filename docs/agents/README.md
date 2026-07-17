# Agent SOPs

Entry: repository root [AGENTS.md](../../AGENTS.md).

| Doc | When to use |
|-----|-------------|
| [ownership-zones.md](./ownership-zones.md) | Where may I edit? Conflict policy |
| [change-design.md](./change-design.md) | How to structure a change |
| [upstream-sync.md](./upstream-sync.md) | Merging an upstream release tag |
| [deploy-release.md](./deploy-release.md) | Image + edge (React static) publish |
| [pr-checklist.md](./pr-checklist.md) | Before opening/merging a PR |
| [next-actions.md](./next-actions.md) | **What to build next** (post customer-shell backlog) |

## Product surfaces (do not invent alternate hosts)

| Host | Role | Code |
|------|------|------|
| `you-box.com` | **Customer shell** (marketing, Creator, auth, account, checkout, status) | `web/` |
| `console.you-box.com` | **Admin console** (+ WeChat MP payment exception) | `frontend/` (Go embed) |
| `api.you-box.com` | Public model API (API Key / gateway) | `backend/` edge-filtered |

**Current truth:** one customer domain/session on apex; console is admin-first; Web SSO and parent-domain cookies are gone.

**Not current architecture:** dual customer shells linked by Web SSO, console-as-identity-host, parent-domain cookies.

Detail: [WEB_PLATFORM.md](../WEB_PLATFORM.md) · Shipped ledger: [CUSTOMER_SHELL_UNIFICATION.md](../CUSTOMER_SHELL_UNIFICATION.md) · Optimize next: [next-actions.md](./next-actions.md).
