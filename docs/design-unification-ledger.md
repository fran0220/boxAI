# 设计语言统一台账

**目标：** `you-box.com`（React 产品面）与 `console.you-box.com`（Vue 控制台）共用同一套 **teal→cyan** `--bx-*` token 与深色优先。见 [WEB_PLATFORM.md](./WEB_PLATFORM.md)、[BRAND.md](./BRAND.md)。  
**默认主题：** 深色（`#080a0d`）。浅色为用户显式切换（控制台）。  
**状态：** `pending` → `done` · 审查时更新本表。

## F. React 营销 + 创作台（web/）

| ID | 项 | 路径 | 状态 |
|----|-----|------|------|
| F1 | Token 与控制台对齐（teal/cyan，无紫）+ 圆角矩形/expo-out | `web/src/index.css` | done |
| F2 | 字体 Space Grotesk + Noto Sans SC | `web/index.html`, tailwind | done |
| F3 | Aurora / Cube / GradientRing | `web/src/components/brand/*` | done |
| F4 | 壳层 Header/Footer/Layout | `web/src/components/*` | done |
| F5 | Home 融合布局 | `web/src/pages/Home.tsx` | done |
| F6 | Studio / Pricing / Account | `web/src/pages/*` | done |
| F7 | Creator 壳 CreateLayout + tabs | `web/src/pages/create/CreateLayout.tsx` | done |
| F8 | 视频页 / 资产页 / ModelPicker | `create/Video`, `Assets`, `ModelPicker` | done |
| F9 | 图像 playground 对齐 teal primary | `image-playground/index.css` | done |
| F10 | Logo 资产 | `web/public/logo.svg`, `logo.png` | done |
| F11 | 语义色 danger/success/warning + icon-btn | `web/src/index.css` | done |
| F12 | Creator 左抽屉 + 自研页 token 收干净 | `create/*` | done |
| F13 | Playground 品牌皮肤（teal/rect/focus） | `image-playground` | done |
| F14 | Public System Status `/status` + homepage summary | `web/src/pages/Status.tsx`, `HomeStatusSummary` | done |
| F15 | Status surface CSS (grid/card/timeline/pills) | `web/src/index.css` `.bx-status-*` | done |

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
| E3 | 全站扫后 simple 发版 `v0.1.155-box.6` | done |
| E4 | 生产 pin `0.1.155-box.6` | done |

## 验收清单

- [x] 控制台默认深色，背景与首页同系（`#080a0d`）
- [x] 侧栏/顶栏 glass elevated，非纯白
- [x] 主按钮 CTA 渐变接近首页（`--bx-grad-cta`）
- [x] 表格/卡片弱白边（`--bx-border`）
- [x] 登录页与首页同系
- [x] 首页动画与文案未回归
- [x] 业务页表面批量切到 token（非仅壳层）
