# Agent SOPs

Entry: repository root [AGENTS.md](../../AGENTS.md).

| Doc | When to use |
|-----|-------------|
| [ownership-zones.md](./ownership-zones.md) | Where may I edit? Conflict policy |
| [change-design.md](./change-design.md) | How to structure a change |
| [upstream-sync.md](./upstream-sync.md) | Merging an upstream release tag |
| [deploy-release.md](./deploy-release.md) | Commit-based production deploy + separate public releases |
| [../CREATOR_CLOUD.md](../CREATOR_CLOUD.md) | Creator cloud (Postgres + private R2) |
| [pr-checklist.md](./pr-checklist.md) | Before opening/merging a PR |

## Product surfaces (do not invent alternate hosts)

| Host | Code |
|------|------|
| `you-box.com` | `web/` |
| `console.you-box.com` | `frontend/` (embed) |
| `api.you-box.com` | `backend/` gateway edge |

Detail: [WEB_PLATFORM.md](../WEB_PLATFORM.md).
