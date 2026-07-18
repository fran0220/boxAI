# BoxAI documentation

## Architecture

| Doc | Content |
|-----|---------|
| [WEB_PLATFORM.md](./WEB_PLATFORM.md) | Hosts, customer shell (apex React), Creator, edge paths |
| [CUSTOMER_SHELL_UNIFICATION.md](./CUSTOMER_SHELL_UNIFICATION.md) | Target: apex React customer shell; console admin-only |
| [OFFICE_MODULE.md](./OFFICE_MODULE.md) | Desktop client |
| [BRAND.md](./BRAND.md) | Brand tokens and compliance freeze |

## Develop

| Doc | Content |
|-----|---------|
| [LOCAL_DEV.md](./LOCAL_DEV.md) | Backend + Vue console + React web |
| [../DEV_GUIDE.md](../DEV_GUIDE.md) | Tooling, CI, pitfalls |
| [../AGENTS.md](../AGENTS.md) | Soft-fork rules for agents |

## Operate

| Doc | Content |
|-----|---------|
| [PRODUCTION.md](./PRODUCTION.md) | Live topology, backup, upgrade |
| [agents/deploy-release.md](./agents/deploy-release.md) | Image release + edge helpers |
| [../deploy/nginx-you-box.com.conf](../deploy/nginx-you-box.com.conf) | Nginx multi-host config |

## Agents (soft-fork SOPs)

| Doc | Content |
|-----|---------|
| [../AGENTS.md](../AGENTS.md) | Root agent entry |
| [agents/README.md](./agents/README.md) | Agent SOP index |
| [../FORK_DELTA.md](../FORK_DELTA.md) | Delta inventory |
| [agents/ownership-zones.md](./agents/ownership-zones.md) | Path policies |
| [agents/change-design.md](./agents/change-design.md) | How to change code |
| [agents/upstream-sync.md](./agents/upstream-sync.md) | Upstream merge SOP |
| [agents/deploy-release.md](./agents/deploy-release.md) | Commit-based production deploy + public release boundary |
| [CREATOR_CLOUD.md](./CREATOR_CLOUD.md) | Creator Postgres metadata + private R2 objects |
| [agents/pr-checklist.md](./agents/pr-checklist.md) | PR gates |

## Other

| Doc | Content |
|-----|---------|
| [PAYMENT.md](./PAYMENT.md) / [PAYMENT_CN.md](./PAYMENT_CN.md) | Payments |
| [BATCH_IMAGE_MVP.md](./BATCH_IMAGE_MVP.md) | Batch image API |
| [i18n/](./i18n/) | Localization process |
| [legal/](./legal/) | Frozen compliance copy (Sub2API wording by design) |
