# BoxAI 项目开发指南

> 本地环境、CI 版本与常见坑。Agent 行为规范见根目录 [AGENTS.md](./AGENTS.md) 与 [docs/agents/](./docs/agents/)。

## 一、项目基本信息

| 项目 | 说明 |
|------|------|
| **产品名** | BoxAI |
| **上游仓库** | [Wei-Shaw/sub2api](https://github.com/Wei-Shaw/sub2api) |
| **本仓库** | [fran0220/boxAI](https://github.com/fran0220/boxAI) |
| **技术栈** | Go 后端 (Ent + Gin) + **客户壳 React** (`web/`) + **管理台 Vue** (`frontend/`) + Tauri Desktop (`desktop/`) |
| **生产域名** | 客户壳 `you-box.com` · 管理台 `console.you-box.com` · API `api.you-box.com` |
| **数据库** | PostgreSQL 16+ + Redis |
| **包管理** | 后端: Go modules；控制台与 web: **pnpm**（各自 lockfile） |
| **Go 版本** | 以 `backend/go.mod` 为准（当前 **1.26.5**；release CI 会校验） |
| **公开镜像** | `ghcr.io/fran0220/boxai`（生产必须 pin tag，禁用裸 `:latest`）；**仅内嵌 Vue**，React 静态另发 |
| **版本 tag** | `vX.Y.Z-box.N`（`X.Y.Z` = 已合入上游基线） |

### 必读文档

| 文档 | 用途 |
|------|------|
| [AGENTS.md](./AGENTS.md) | Agent 硬规则入口 |
| [docs/agents/](./docs/agents/) | 分区 / 改码 / 同步 / 发布 / PR 清单 |
| [docs/WEB_PLATFORM.md](./docs/WEB_PLATFORM.md) | 主机拓扑、客户壳、管理台、Creator |
| [docs/CUSTOMER_SHELL_UNIFICATION.md](./docs/CUSTOMER_SHELL_UNIFICATION.md) | 客户壳统一状态（已上线） |
| [docs/agents/next-actions.md](./docs/agents/next-actions.md) | 统一后的优化 backlog |
| [docs/LOCAL_DEV.md](./docs/LOCAL_DEV.md) | 本地三进程（backend + Vue 管理台 + React 客户壳） |
| [docs/PRODUCTION.md](./docs/PRODUCTION.md) | 生产拓扑与切换脚本 |
| [docs/OFFICE_MODULE.md](./docs/OFFICE_MODULE.md) | Desktop 客户端 |
| [FORK_DELTA.md](./FORK_DELTA.md) | 相对上游的产品 delta 清单 |
| [docs/BRAND.md](./docs/BRAND.md) | 品牌与合规冻结 |
| [docs/agents/upstream-sync.md](./docs/agents/upstream-sync.md) | 上游同步 SOP |
| [docs/agents/deploy-release.md](./docs/agents/deploy-release.md) | 部署与公开发版 |

## 二、本地环境配置

### PostgreSQL

| 配置项 | 值 |
|--------|-----|
| 端口 | 5432 |
| 数据库凭据 | user=`sub2api`, password=`sub2api`, dbname=`sub2api` |

（Windows 服务路径、pg_hba 等环境相关细节按本机安装调整；开发库名保持 `sub2api` 以兼容上游。）

### Redis

| 配置项 | 值 |
|--------|-----|
| 端口 | 6379 |
| 密码 | 无（本地默认） |

### 开发工具

```bash
# golangci-lint（版本跟随上游 CI 文档；当前仓库沿用 v2.x）
go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@v2.7

# pnpm
npm install -g pnpm
```

## 三、CI/CD 流水线

| Workflow | 触发 | 内容 |
|----------|------|------|
| **backend-ci.yml** | push, pull_request | 单元 / 集成测试 + golangci-lint |
| **security-scan.yml** | push, pull_request, 周一 | govulncheck + gosec + pnpm audit |
| **fork-gates.yml** | push, pull_request | compliance-hash + migration-lint（BoxAI 门禁） |
| **release.yml** | tag `v*` / workflow_dispatch | 构建发布（含 Docker） |

### 本地门禁

```bash
# BoxAI fork gates
python3 tools/check_compliance_hash.py
python3 tools/check_migration_lint.py

# 后端
cd backend && go test -tags=unit ./...
cd backend && go test -tags=integration ./...
cd backend && golangci-lint run ./...

# 控制台 Vue
cd frontend && pnpm install --frozen-lockfile
cd frontend && pnpm run lint:check && pnpm run typecheck

# 产品面 React（营销 / Creator）
cd web && pnpm install --frozen-lockfile
cd web && pnpm typecheck && pnpm test:run
```

### 本地双前端（摘要）

完整说明见 [docs/LOCAL_DEV.md](./docs/LOCAL_DEV.md)。

| 进程 | 端口 | 目录 | 命令 |
|------|------|------|------|
| 后端 | 8080 | `backend/` | `go run ./cmd/server` |
| 控制台 | 3000 | `frontend/` | `pnpm dev:local-api` |
| 营销+Creator | 5173 | `web/` | `pnpm dev` |

生产 URL 对照：`5173` → `you-box.com`，`3000` → `console.you-box.com`，API 过滤面 → `api.you-box.com`。

## 四、上游同步（摘要）

完整步骤见 [docs/agents/upstream-sync.md](./docs/agents/upstream-sync.md)。

```bash
git remote add upstream https://github.com/Wei-Shaw/sub2api.git   # 一次性
git fetch upstream --tags
git checkout upstream-main && git merge --ff-only upstream/main
git checkout -b sync/vX.Y.Z main
git merge vX.Y.Z
# 按 docs/agents/ownership-zones.md 解冲突
# 跑门禁后开 sync-only PR
```

**原则**：按上游 **release tag** 合并；`main` 用 merge 不用 rebase；sync PR 不夹带功能。

## 五、常见坑点 & 解决方案

### 坑 1：pnpm-lock.yaml 必须同步提交

`package.json` 变更后必须用 **pnpm** 更新并提交 `pnpm-lock.yaml`，否则 CI `pnpm install --frozen-lockfile` 失败。

### 坑 2：npm 与 pnpm 的 node_modules 冲突

```bash
cd frontend && rm -rf node_modules && pnpm install
```

### 坑 3：Ent schema 修改后必须重新生成

```bash
cd backend && go generate ./ent && git add ent/
```

### 坑 4：interface 新增方法后 test stub 必须补全

搜索 stub/mock 实现并补方法，否则编译失败。

### 坑 5：合规文案不可随意改

`adminCompliance` 与 `docs/legal/*` 由 `tools/check_compliance_hash.py` 钉死。误改会使历史管理员确认失效。

### 坑 6：BoxAI 迁移号段

产品自有 SQL 仅允许 `backend/migrations/9xx_boxai_*.sql`。不要在产品 PR 里新增 `<900` 的上游风格迁移。

### 坑 7：品牌字符串散落

- 前端：只引用 `frontend/src/constants/brand.ts`
- 后端：只引用 `backend/internal/branding`
- 触及上游文件时加 `// BOXAI:` 并更新 `FORK_DELTA.md`

### 坑 8：PR 提交前检查清单

见 [docs/agents/pr-checklist.md](./docs/agents/pr-checklist.md)。至少：

- [ ] 单测 / 必要集成测
- [ ] lint
- [ ] fork gates
- [ ] lockfile / ent 生成物已提交
- [ ] FORK_DELTA 已更新（若有上游文件 diff）

## 六、常用命令

### Git / 上游

```bash
git fetch upstream --tags
git checkout main
git merge upstream-main   # 仅在遵循 sync SOP 时
```

### 前端

```bash
cd frontend
pnpm install
pnpm dev          # 默认读 .env.development.local（可指到线上 API）
pnpm build
```

#### 推荐：本地前端 + 线上后端 / 数据库（日常 UI 开发）

不启动本机 Postgres / Redis / Go，只跑 Vite；API 经代理打到生产。

```bash
cd frontend
# 首次：复制示例（仓库已可带 .env.development.local.example）
cp -n .env.development.local.example .env.development.local

# 默认示例指向 https://you-box.com
# 编辑 .env.development.local 可改目标：
#   VITE_DEV_PROXY_TARGET=https://you-box.com
#   VITE_DEV_PORT=3000

pnpm dev
# 或显式：pnpm dev:remote
```

| 项 | 说明 |
|----|------|
| 浏览器 | `http://localhost:3000`（或 `VITE_DEV_PORT`） |
| API 代理 | `/api` `/v1` `/setup` `/health` → `VITE_DEV_PROXY_TARGET` |
| 鉴权 | Bearer token 存在 **本机** `localStorage`；登录用线上账号即可 |
| 数据 | 读写 **生产库**（操作前想清楚） |
| 本地全栈 | `pnpm dev:local-api` 且本机 `8080` 跑后端；或删掉/改掉 `.env.development.local` |

**注意：**

1. **不要**把 `VITE_API_BASE_URL` 设成 `https://you-box.com`，否则浏览器直连线上会撞 CORS；保持默认相对路径 `/api/v1`，走 Vite 同源代理。
2. **OAuth / 支付回调** 仍指向生产域名，本地调试 OAuth 可能跳到 `you-box.com`；账号密码登录一般够用。
3. `.env.development.local` 已被 gitignore，勿提交密钥或内网地址。
4. 启动日志应出现：`[vite] API proxy → https://you-box.com (remote prod backend + DB)`。
5. 若改了 `vite.config.ts` 却不生效，检查是否残留本地编译产物 `frontend/vite.config.js`（已 gitignore）；删掉后以 `.ts` 为准。

#### Agentation（本地 UI 标注 → 给 AI 调试）

[Agentation](https://github.com/benjitaylor/agentation) 是 React 组件；本仓库用 **dev-only React 岛** 挂到 `body`，**生产构建不会打入**。

```bash
cd frontend
pnpm install   # 已含 agentation + react 作为 devDependencies
pnpm dev       # 右下角出现 Agentation 工具条
```

| 操作 | 说明 |
|------|------|
| 点右下角图标 | 激活标注模式 |
| 点击页面元素 / 框选 | 写反馈，复制 markdown 给 agent |
| 可选 MCP 同步 | 另开终端：`pnpm agentation:mcp`（默认 `http://localhost:4747`） |

MCP 给 Cursor / Claude Code 等用时可：

```bash
npx add-mcp "npx -y agentation-mcp server"
# 或
npx agentation-mcp doctor
```

实现：`frontend/src/dev/mountAgentation.ts`，入口在 `main.ts` 的 `import.meta.env.DEV` 分支。

### 后端

```bash
cd backend
go run ./cmd/server/
go generate ./ent
go test -tags=unit ./...
```

本地全栈时仍需 Postgres + Redis（见上文端口）。若只做前端，用 **dev:remote** 即可，不必起后端。

### 部署（生产推荐）

```bash
cd deploy
# 编辑 .env：设置 POSTGRES_PASSWORD、JWT_SECRET，并 pin BOXAI_IMAGE
docker compose -f docker-compose.local.yml up -d
```

## 七、项目结构速览

```
boxAI/
├── AGENTS.md                 # Agent 入口
├── FORK_DELTA.md             # 产品 delta 清单
├── DEV_GUIDE.md              # 本文
├── docs/
│   ├── agents/               # 同步 / 发布 / 分区 SOP
│   ├── BRAND.md
│   └── legal/                # 合规文案（冻结）
├── backend/
│   ├── cmd/server/
│   ├── internal/branding/    # BoxAI 产品常量（product-first）
│   ├── internal/{handler,service,repository,server}/
│   ├── ent/
│   └── migrations/           # <900 上游；9xx_boxai_* 产品
├── frontend/
│   └── src/constants/brand.ts
├── deploy/                   # compose / install / entrypoint
└── tools/                    # compliance-hash / migration-lint
```

## 八、参考资源

- [上游仓库](https://github.com/Wei-Shaw/sub2api)
- [Ent 文档](https://entgo.io/docs/getting-started)
- [Vue3 文档](https://vuejs.org/)
- [pnpm 文档](https://pnpm.io/)
