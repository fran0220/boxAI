# 设计语言统一台账

**目标：** 控制台与首页共用首页北极星设计 token（`--bx-*`）。  
**默认主题：** 深色（`#080a0d`）。浅色仅作用户显式切换的可读 fallback。  
**状态：** `pending` → `done` · 审查时更新本表。

## A. 设计源与全局

| ID | 项 | 路径 | 状态 |
|----|-----|------|------|
| A1 | 全局 token | `frontend/src/styles/tokens.css` | done |
| A2 | 首页动画壳 | `frontend/src/styles/home-platform.css` | done |
| A3 | Tailwind 映射 | `frontend/tailwind.config.js` | done |
| A4 | 全局 primitives | `frontend/src/style.css` | done |
| A5 | 默认 dark + 字体 | `frontend/src/main.ts`, `frontend/index.html` | done |
| A6 | 品牌文档 | `docs/BRAND.md`, `FORK_DELTA.md` | done |

## B. 壳层组件（必过）

| ID | 组件 | 路径 | 状态 | 审查要点 |
|----|------|------|------|----------|
| B1 | AppLayout | `components/layout/AppLayout.vue` | done | `bx-page` + `bx-ambient-mesh` |
| B2 | AppSidebar | `components/layout/AppSidebar.vue` | done | elevated、激活态、边框 token |
| B3 | AppHeader | `components/layout/AppHeader.vue` | done | glass elevated、下拉 token |
| B4 | TablePageLayout | `components/layout/TablePageLayout.vue` | done | 表壳 card tokens（无硬编码白底） |
| B5 | AuthLayout | `components/layout/AuthLayout.vue` | done | 深色 ambient + glass card |
| B6 | 侧栏全局 class | `style.css` `.sidebar*` | done | 随 A4 |

## C. 全局 primitives（style.css）

| ID | 类 | 状态 |
|----|-----|------|
| C1 | `.btn-primary` / secondary / ghost | done |
| C2 | `.input*` | done |
| C3 | `.card*` / `.glass*` | done（utilities 层旧 white glass 已移除） |
| C4 | `.table*` | done |
| C5 | `.badge*` | done |
| C6 | `.dropdown*` | done |
| C7 | `.modal*` / `.dialog*` | done |
| C8 | `.toast*` | done |
| C9 | `.tabs*` / `.page-*` / empty / skeleton / progress / code | done |

## D. 高流量页面 + 全站表面扫

| ID | 页面 | 路由 | 状态 |
|----|------|------|------|
| D1 | 首页 | `/` | done |
| D2 | 登录/注册 | AuthLayout 下 | done |
| D3 | 用户 Dashboard | `/dashboard` | done（token 表面） |
| D4 | API Keys | `/keys` | done |
| D5 | 用量 | `/usage` | done |
| D6 | 分组 | `/admin/groups` | done |
| D7 | 订阅管理 | `/admin/subscriptions` | done |
| D8 | 账号 | `/admin/accounts` | done |
| D9 | 设置 | `/admin/settings` | done（tabs shell token） |
| D10 | 批量出图 | `/batch-image` | done |
| D11 | 全站 bulk | `frontend/src/**/*.vue` | done：`bg-white dark:bg-*` → `var(--bx-*)` |

> 扫表结果（box.6）：`bg-white dark:bg-*` = 0；`min-h-screen bg-gray` = 0；约 885 处 `var(--bx-bg*)`。  
> 故意保留：二维码白底、开关圆点 `bg-white`。

## E. 发布

| ID | 项 | 状态 |
|----|-----|------|
| E1 | simple 发版 `v0.1.155-box.5` | done |
| E2 | 生产 pin `0.1.155-box.5` | done |
| E3 | 全站扫后 simple 发版 `v0.1.155-box.6` | pending |
| E4 | 生产 pin `0.1.155-box.6` | pending |

## 验收清单

- [x] 控制台默认深色，背景与首页同系（`#080a0d`）
- [x] 侧栏/顶栏 glass elevated，非纯白
- [x] 主按钮 CTA 渐变接近首页（`--bx-grad-cta`）
- [x] 表格/卡片弱白边（`--bx-border`）
- [x] 登录页与首页同系
- [x] 首页动画与文案未回归
- [x] 业务页表面批量切到 token（非仅壳层）
