# BoxAI Desktop（桌面客户端）

**Product name:** BoxAI Desktop  
**形态:** Tauri 桌面客户端（React WebView + Rust shell）+ 可选自托管 Go 网关  
**Web:** 主站提供登录握手页 `/desktop-auth` 与下载页 `/download/desktop`

**Code:** `desktop/`（vendored [BoxLiveAgent](https://github.com/fran0220/BoxLiveAgent)，上游为 `Stack-Cairn/LiveAgent`；溯源见 `desktop/UPSTREAM.md`）  
**Desktop app:** `desktop/crates/agent-gui/`（Tauri + React）  
**Remote gateway:** `desktop/crates/agent-gateway/`（Go，可选自托管远程访问）  
**Backend 集成:** `backend/internal/handler/boxai_desktop_*.go` + `backend/internal/server/routes/{auth,gateway}.go`（BOXAI 标记）

> 历史备注：曾计划以 Electron soft-fork craft-agents-oss 实现「BoxAI Office」，
> 该方案已废弃，`office/` 目录与 bootstrap API 不存在。本文档描述当前实现。

---

## 目标

1. 用户安装桌面端，用 **BoxAI 账户** 登录（系统浏览器 OAuth + PKCE，非应用内输密码）
2. 自动托管 **锁定的两个 Provider**：`BoxAI (Claude)` 与 `BoxAI (OpenAI)`；设置中 **无** 自定义 API / 多 Provider
3. 模型与计费走 BoxAI 网关 `/v1/*`，凭据为用户 **JWT**（JWT-as-credential，后端桥接到 API key）
4. 模型目录从 `<server>/v1/models` 动态拉取并本地缓存，内置精选列表兜底
5. Access token 到期前自动刷新（refresh token），失效则回到登录页
6. 品牌 / UI 全量 BoxAI；服务器地址可配置、无默认值
7. 主站下载页 `/download/desktop` 列出各平台安装包
8. 上游（BoxLiveAgent）以手动 vendored copy 方式同步

## 非目标

- 浏览器内 Agent 工作台（Agent 逻辑只在本机客户端）
- 应用内账号密码登录（统一走浏览器 OAuth）
- Docker 侧车作为产品组件

---

## 架构

```
BoxAI Desktop (Tauri)
  login    → 打开系统浏览器 <server>/desktop-auth?state&code_challenge&redirect_uri
  callback → boxai-desktop://auth/callback?code&state（deep link 自动回跳；失败可手动粘贴）
  token    → POST /api/v1/auth/boxai/desktop/token（PKCE code 换 JWT）
  refresh  → POST /api/v1/auth/refresh（到期前自动续期）
  models   → GET <server>/v1/models（Bearer JWT，动态目录 + 本地缓存）
  chat     → POST <server>/v1/messages 或 /v1/chat/completions（Bearer JWT）

主站 Web
  /desktop-auth      → 登录握手页（登录态下 mint 一次性 PKCE code 并重定向回桌面端）
  /download/desktop  → 下载页（读取 GitHub desktop-v* release 资产）

Backend
  /api/v1/auth/boxai/desktop/authorize（登录态） / token（公开）
  /v1/* JWT-as-credential 桥（flag BOXAI_DESKTOP_JWT_GATEWAY，默认开）
```

---

## 客户端登录流

1. 首启输入 BoxAI 服务器地址（无默认值），点击 Sign in
2. 桌面端生成 PKCE verifier/challenge + state，打开系统浏览器 `<server>/desktop-auth?...`
3. 浏览器侧登录后（`requiresAuth` 路由先走 `/login`），前端调 `POST /api/v1/auth/boxai/desktop/authorize` mint 一次性 code，重定向 `boxai-desktop://auth/callback?code&state`
4. 桌面端经 deep link（`tauri-plugin-deep-link` + single-instance，事件 `boxai://auth-callback`）收到回跳；浏览器未能自动回跳时可手动粘贴链接
5. `POST /api/v1/auth/boxai/desktop/token` 用 code + verifier 换 access/refresh token，本地持久化
6. 拉取 `/v1/models` 动态模型目录并缓存，接入两个锁定 Provider，进入主界面

Token 刷新：到期前约 5 分钟调度 `POST /api/v1/auth/refresh`，瞬时失败重试，refresh 失效则登出。

---

## 后端 API

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| POST | `/api/v1/auth/boxai/desktop/authorize` | 用户 JWT | mint 一次性 PKCE code（绑定 code_challenge + redirect_uri） |
| POST | `/api/v1/auth/boxai/desktop/token` | 公开（PKCE） | code + verifier 换 JWT access/refresh token |
| ANY | `/v1/*` | Bearer JWT 或 `sk-*` | JWT 经桥接换用户 desktop API key 后走上游网关逻辑 |

环境变量（后端）：

| 变量 | 说明 |
|------|------|
| `BOXAI_DESKTOP_JWT_GATEWAY` | `/v1` JWT-as-credential 桥开关（默认开） |

---

## 自托管远程网关（可选）

`desktop/crates/agent-gateway/` 供用户自托管以远程访问桌面 Agent（WebUI + gRPC）。

| 变量 / flag | 说明 |
|------|------|
| `LIVEAGENT_GATEWAY_TOKEN` / `-token` | 静态共享 token（必填） |
| `BOXAI_SERVER_URL` / `-boxai-server-url` | 可选；配置后额外接受 BoxAI 账户 JWT，网关调 `<server>/api/v1/auth/me` 校验（结果短缓存） |

---

## 主站下载页

- 路由：`/download/desktop`（公开），组件 `frontend/src/views/public/DesktopDownloadView.vue`
- 客户端拉取 GitHub Releases，取最新 `desktop-v*` 非预发布 release，按平台列出资产
- 仓库可用 `VITE_DESKTOP_RELEASE_REPO` 覆盖（默认 `fran0220/boxAI`）
- 拉取失败时回退到 GitHub Releases 列表链接

## GitHub 构建与发版

| 项 | 值 |
|----|-----|
| Workflow | `.github/workflows/desktop-release.yml`（由 `desktop/.github/workflows/` 同名文件适配 monorepo 路径） |
| Tag | `desktop-vX.Y.Z`（与主站 `vX.Y.Z-box.N` 分离；desktop release 不抢 repo `latest`） |
| 触发 | push tag 或 workflow_dispatch |
| 产物 | macOS x64/aarch64 dmg + updater `.app.tar.gz`、Windows msi/exe/portable zip、Linux AppImage/deb/rpm、`latest.json` updater manifest |
| 应用内更新 | 桌面端读 repo `releases.atom`，只认 `desktop-v*` tag，取 release 资产中的 `latest.json`（Tauri updater 签名校验） |

```bash
# 发版示例
git tag desktop-v0.1.0
git push origin desktop-v0.1.0
# 或 Actions → Desktop Release → Run workflow
```

本地开发客户端：

```bash
cd desktop/crates/agent-gui
pnpm install
pnpm tauri dev        # 需要 Rust 工具链 + protobuf（brew install protobuf）
```

---

## 本机数据

会话与配置由 Tauri app 存储在系统应用数据目录；BoxAI 会话（token、服务器地址、模型缓存）持久化于前端 localStorage（`boxai_desktop_session_v1` / `boxai_desktop_model_catalog_v1`）。

---

## 仓库与 merge

- `desktop/` 为 **fork-owned product-first** 树（整树列于 `FORK_DELTA.md`），内部改动无需 BOXAI 标记
- 上游同步：手动 clone BoxLiveAgent 对比合入，保留产品 delta；见 `desktop/UPSTREAM.md`
- 主站侧改动（backend/frontend）遵循 sync-first 规则，带 `// BOXAI:` 标记并列入 `FORK_DELTA.md`

---

## 安全要点

- JWT / refresh token 仅存本机，勿打日志
- 桥接生成的 desktop API key 由后端托管，客户端不落盘 `sk-*`
- 一次性 PKCE code 短 TTL、绑定 challenge 与 redirect scheme（仅 `boxai-desktop://`）
- 本机 Agent 可执行工具：安装说明中提示风险
