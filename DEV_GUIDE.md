# BoxAI 项目开发指南

> 本地环境、CI 版本与常见坑。Agent 行为规范见根目录 [AGENTS.md](./AGENTS.md) 与 [docs/agents/](./docs/agents/)。

## 一、项目基本信息

| 项目 | 说明 |
|------|------|
| **产品名** | BoxAI |
| **上游仓库** | [Wei-Shaw/sub2api](https://github.com/Wei-Shaw/sub2api) |
| **本仓库** | [fran0220/boxAI](https://github.com/fran0220/boxAI) |
| **技术栈** | Go 后端 (Ent ORM + Gin) + Vue3 前端 (pnpm) |
| **数据库** | PostgreSQL 16+ + Redis |
| **包管理** | 后端: Go modules；前端: **pnpm**（不是 npm） |
| **Go 版本** | 以 `backend/go.mod` 为准（当前 **1.26.5**；release CI 会校验） |
| **公开镜像** | `ghcr.io/fran0220/boxai`（生产必须 pin tag，禁用裸 `:latest`） |
| **版本 tag** | `vX.Y.Z-box.N`（`X.Y.Z` = 已合入上游基线） |

### 必读文档

| 文档 | 用途 |
|------|------|
| [AGENTS.md](./AGENTS.md) | Agent 硬规则入口 |
| [docs/agents/](./docs/agents/) | 分区 / 改码 / 同步 / 发布 / PR 清单 |
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

# 前端
cd frontend && pnpm install --frozen-lockfile
cd frontend && pnpm run lint:check && pnpm run typecheck
```

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
pnpm dev
pnpm build
```

### 后端

```bash
cd backend
go run ./cmd/server/
go generate ./ent
go test -tags=unit ./...
```

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
