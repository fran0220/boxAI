# 设计语言统一台账

**目标：** `you-box.com`（React 产品面）与 `console.you-box.com`（Vue 控制台）共用同一套 **Precision Teal** `--bx-*` token 与深色优先。见 [WEB_PLATFORM.md](./WEB_PLATFORM.md)、[BRAND.md](./BRAND.md)。  
**默认主题：** 深色（`#06080a`，brand `#1fd5b9`）。浅色为用户显式切换。  
**设计源：** Claude Design `5c213057…` → `web/design-source/`（单一设计包，无版本后缀）。  
**状态：** `pending` → `done` · 审查时更新本表。

## 单一设计系统

| 层 | 真相源 | 备注 |
|----|--------|------|
| Product tokens | `web/src/index.css` | `--bx-*` + compat aliases |
| Design reference | `web/design-source/tokens.css` | Claude Design export |
| Console tokens | `frontend/src/styles/tokens.css` | 同一 Precision Teal 语义 |
| Marketing primitives | `web/src/components/marketing/*` | FAQ 编号行、CTA 网格带、SectionHead |
| Account primitives | `.bx-account-*` in `web/src/index.css` | 工具条 / 表壳 / 状态 pill |
| Creator shell | `.bx-create-*` | 左抽屉 + panels |

**已移除的旧营销组件：** `Accordion`、`GradientRing`、`AuroraBackground`、`CubeMark`、`Section`（旧 Section+Accordion 套件）。Home 自带 `HeroBackdrop`，Layout 不再叠第二层 ambient。

## F. React 营销 + 创作台（web/）— 视口 parity

| ID | 页面 / 面 | 路径 | Parity |
|----|-----------|------|--------|
| F1 | Tokens Precision Teal + compat | `web/src/index.css`, `design-source/tokens.css` | done |
| F2 | 字体 Manrope + Noto Sans SC + IBM Plex Mono | `web/index.html`, tailwind | done |
| F3 | 壳层 Header mega-menu / Footer | `Header.tsx`, `Footer.tsx` | done |
| F4 | Home（设计 11 section + 真实 status API） | `pages/Home.tsx` | done |
| F5 | Pricing（plan 卡 + 对比表 + 编号 FAQ + CTA band） | `pages/Pricing.tsx` | done |
| F6 | Studio（features / download API / 编号 FAQ / CTA） | `pages/Studio.tsx` | done |
| F7 | Status（eyebrow chrome + period pills + ready/empty） | `pages/Status.tsx` | done |
| F8 | Auth 玻璃卡片 + brand mark + ambient | `pages/auth/*` | done |
| F9 | Account 分组导航 + Overview/Keys/Usage 等 `bx-account-*` | `pages/account/*` | done |
| F10 | Creator 壳 CreateLayout + tabs | `create/CreateLayout.tsx` | done |
| F11 | 视频页 / 资产页 / ModelPicker | `create/Video`, `Assets`, `ModelPicker` | done |
| F12 | 图像 playground teal skin | `image-playground/index.css` | done |
| F13 | Logo 资产 | `web/public/logo.svg`, `logo.png` | done |
| F14 | 语义色 + icon-btn | `web/src/index.css` | done |
| F15 | Public System Status surface CSS | `.bx-status-*` | done |
| F16 | 命名收敛（单一 design-source 包，无版本后缀） | `design-source/`, docs | done |

### Waves（本轮全部完成）

| Wave | 范围 | 状态 |
|------|------|------|
| 1 | Marketing: Pricing / Studio / Status / Home ambient | **done** |
| 2 | Auth glass + Account depth (`bx-account-*`) | **done** |
| 3 | Creator shell residual | **done**（已 token 化；本轮确认） |
| 4 | 单一设计包命名 + 删除旧营销组件 + 台账 | **done** |

## A. 设计源与全局（Vue 控制台）

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
- [x] React 营销面单一设计语言（无 v1/v2 标志）
- [x] Pricing / Studio / Status 与 Home 同系 section / FAQ / CTA
- [x] 空成功态显式 empty（非永久 loading）
