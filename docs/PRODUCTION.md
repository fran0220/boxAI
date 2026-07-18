# BoxAI 单机生产部署

BoxAI 生产只维护一条简单链路：**选择 Git commit → 单台生产机本地构建 → Compose 更新应用进程 → 发布 React 静态文件**。日常上线不依赖 Git tag、GHCR 或 Docker 版本发布。

架构：[`WEB_PLATFORM.md`](./WEB_PLATFORM.md) · 本地开发：[`LOCAL_DEV.md`](./LOCAL_DEV.md) · Agent SOP：[`agents/deploy-release.md`](./agents/deploy-release.md)

## 1. 服务形态

```diagram
Cloudflare DNS / CDN / private R2
                 │
                 ▼
       ┌──────────────────┐
       │ Nginx :80 / :443 │  唯一公网入口
       └───┬──────┬────┬──┘
           │      │    │
           │      │    └──────────────┐
           │      ▼                   ▼
           │  Go API :8080       Agent Relay
           │  模型网关/身份/       HTTP+WS :8081
           │  Creator 元数据       gRPC :50051
           │      │                   │
           │      ├───────────┐       │
           │      ▼           ▼       │
           │  Postgres 18  Redis 8 ◀──┘
           │
           ▼
    React 静态文件
    /var/www/you-box.com
```

生产机只运行下列组件：

| 层 | 服务 / 容器 | 职责 | 持久化 |
|---|---|---|---|
| Edge | 宿主机 Nginx | TLS、域名和路由；统一暴露 `api.you-box.com` | 证书、站点配置 |
| Product web | React 静态文件 | 营销、用户工作区、Creator、Agent iframe shell | 无；由 CI 构建后同步 |
| Control + model gateway | `sub2api` | Go API、身份/计费、模型 `/v1`、Creator cloud、内嵌 Vue 管理台 | `/opt/boxAI/data` |
| Hosted Agent Relay | `boxai-agent-gateway` | Agent WebUI、WebSocket、gRPC 和按用户隔离的内存会话 | 无；replay 为有界内存 |
| Database | `sub2api-postgres` | 用户、订单、Creator 元数据、迁移 | `/opt/boxAI/postgres_data` |
| Cache | `sub2api-redis` | session、短期 code、限流/缓存 | `/opt/boxAI/redis_data` |
| Object storage | Cloudflare private R2 | Creator 二进制对象 | 云端 bucket，不在生产机 |

**统一 Gateway 指统一公网入口，不强行合并进程。** 模型/Creator API 与 Agent Relay 都由 `api.you-box.com` 暴露，但后者有 WebSocket、gRPC、长连接重认证和桌面会话生命周期，继续作为独立容器更清晰。Nginx 负责路由统一，Go backend 继续作为身份与权限权威源。

> Creator 的云端元数据和文件同步已在 Go + Postgres + R2；生成请求目前仍由浏览器调用模型 gateway。服务端异步 generation worker / orchestration 不属于当前部署服务，不能将其描述为已实现。

## 2. 唯一日常部署链

```diagram
手动运行 Deploy production（输入 branch/tag/SHA）
                    │
                    ▼
       Checkout 并解析 immutable commit
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
 React typecheck/test/build   上传该 commit 的 git archive
          │                   │
          └─────────┬─────────┘
                    ▼
       生产机 docker compose build
          sub2api + agent-gateway
                    │
                    ▼
       备份 DB / env / Nginx / React
                    │
                    ▼
      更新两个应用容器（不重建 PG/Redis）
                    │
                    ▼
       健康检查 → React/Nginx → 公网 smoke
```

入口：[`.github/workflows/deploy-production.yml`](../.github/workflows/deploy-production.yml)，编排器：[`deploy/scripts/ci-deploy.sh`](../deploy/scripts/ci-deploy.sh)。

```bash
# 正常：部署 main 当前 commit
gh workflow run deploy-production.yml -R fran0220/boxAI -f ref=main

# 精确部署或回滚到一个已知 commit
gh workflow run deploy-production.yml -R fran0220/boxAI -f ref=<full-commit-sha>
```

部署规则：

- `workflow_dispatch` 是生产唯一入口，不由 Release workflow 自动触发。
- Go API 和 Agent Relay 在生产机从同一 commit 本地构建为 `boxai-local/*:<commit>`；不 push/pull GHCR。
- React 在 Actions 构建并 rsync；Go 镜像仍只内嵌 Vue 管理台，绝不内嵌 React。
- `.env` 和 R2 凭证只保存在 `/opt/boxAI/.env`，不会从 CI 上传或进入 Git。
- 更新只执行 `sub2api` 和 `agent-gateway`；不会 `compose down`、重建 Postgres/Redis 或删除数据卷。
- 激活失败时脚本自动恢复上一应用、Nginx 和 React；每次上线前备份写入 `/opt/boxAI/backups/`。

GitHub `production` environment 只需要：

| 配置 | 类型 | 说明 |
|---|---|---|
| `DEPLOY_SSH_KEY` | Secret | 部署 SSH 私钥 |
| `DEPLOY_HOST` | Secret | 生产主机 |
| `DEPLOY_USER` | Secret | 有 Docker、docroot、Nginx 管理权限的用户 |
| `DEPLOY_APP_DIR` | Var，可选 | 默认 `/opt/boxAI` |
| `DEPLOY_DOCROOT` | Var，可选 | 默认 `/var/www/you-box.com` |
| `VITE_AGENT_REMOTE_URL` | Var，可选 | 默认 `https://api.you-box.com` |

不需要 `packages:write`、GHCR token、image tag 或 R2 secret。

## 3. 主机目录

```text
/opt/boxAI/
├── .env                         # 运行密钥，0600；部署脚本不覆盖
├── current -> releases/<sha>    # 当前源码 release
├── releases/<sha>/              # git archive，不含用户数据
├── web-releases/<sha>/          # 对应 commit 的 React dist
├── backups/deploy-*/            # 自动上线前备份和回滚信息
├── data/                         # Go 应用数据
├── postgres_data/                # PostgreSQL 数据
└── redis_data/                   # Redis 数据

/var/www/you-box.com/             # 当前 React 静态站
/etc/nginx/sites-available/you-box.com
```

Compose 由两个文件叠加：

1. `deploy/docker-compose.local.yml`：服务、环境变量和网络定义；
2. `deploy/docker-compose.production.yml`：本地 build、commit image 名和生产绝对数据目录。

线上操作统一使用 helper，避免漏掉 override：

```bash
/opt/boxAI/current/deploy/scripts/production-compose.sh ps
/opt/boxAI/current/deploy/scripts/production-compose.sh logs -f --tail=200 sub2api
/opt/boxAI/current/deploy/scripts/production-compose.sh logs -f --tail=200 agent-gateway
```

## 4. 生产环境变量

`/opt/boxAI/.env` 至少包含：

```dotenv
BIND_HOST=127.0.0.1
SERVER_PORT=8080
SERVER_MODE=release
SERVER_TRUSTED_PROXIES=172.16.0.0/12

POSTGRES_USER=sub2api
POSTGRES_PASSWORD=<strong-random-password>
POSTGRES_DB=sub2api
REDIS_PASSWORD=<strong-random-password>

JWT_SECRET=<openssl-rand-hex-32>
TOTP_ENCRYPTION_KEY=<openssl-rand-hex-32>
ADMIN_EMAIL=admin@you-box.com
ADMIN_PASSWORD=<initial-admin-password>

BOXAI_DISABLE_INPLACE_UPDATE=true
BOXAI_BROWSER_SESSION=true
BOXAI_LEGACY_BROWSER_ADOPTION=false
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=15

BOXAI_CREATOR_CLOUD_ENABLED=true
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_REGION=auto
R2_BUCKET=<private-bucket>
R2_ACCESS_KEY_ID=<r2-access-key>
R2_SECRET_ACCESS_KEY=<r2-secret-key>

BOXAI_AGENT_GATEWAY_AUTH_URL=http://sub2api:8080
BOXAI_GATEWAY_AUTH_RECHECK_PERIOD=1m
LIVEAGENT_GATEWAY_RELAY_BUFFER_SECONDS=120
```

关键约束：

- 固定 `JWT_SECRET` / `TOTP_ENCRYPTION_KEY`；轮换会使登录或现有 TOTP 失效。
- R2 bucket 必须 private；浏览器只使用 Go API 签发的短期 presigned URL。
- Hosted Relay 必须保持 multi-tenant 和禁止 shared static token；Compose 已固定这两个值。
- 管理设置通过 `https://console.you-box.com/api/v1/admin/*` 修改；运维凭证在 `/root/.boxai/admin-api.env` 或本机 `~/.config/boxai/admin.env`，不得提交。

## 5. 新主机一次性初始化

前置：Linux、Docker Engine + Compose v2、Nginx、Certbot、`rsync`，开放 80/443。

```bash
sudo mkdir -p /opt/boxAI/{data,postgres_data,redis_data,releases,web-releases,backups}
sudo chmod 700 /opt/boxAI/backups

# 从 deploy/.env.example 创建并填写真实 secret
sudo install -m 0600 deploy/.env.example /opt/boxAI/.env

# 首次只启动数据服务；之后日常 Deploy 不重建它们
export BOXAI_COMMIT="$(git rev-parse HEAD)"
docker compose -p boxai --env-file /opt/boxAI/.env \
  -f deploy/docker-compose.local.yml \
  -f deploy/docker-compose.production.yml \
  up -d postgres redis
```

Nginx 主配置 `http {}` 必须包含 `underscores_in_headers on;`。首次证书/域名配置可使用：

```bash
./deploy/scripts/apply-nginx-topology.sh
```

然后配置 GitHub production secrets，运行一次 `Deploy production`。日常部署会自动更新站点级 Nginx 配置并执行 `nginx -t`，但不负责初次签发证书。

### 现有 Compose 主机的一次性接管

部署脚本会在任何修改前确认 `sub2api-postgres` 和 `sub2api-redis`：

- Compose project label 为 `boxai`；
- mount source 分别为 `${DEPLOY_ROOT}/postgres_data` 和 `${DEPLOY_ROOT}/redis_data`。

当前 youbox 已满足这两个条件，可以直接进行第一次 commit 部署。其它旧主机若不满足，先核对实际 mount 绝对路径并完成一次维护窗口接管；脚本会 fail closed，绝不会自动创建空数据库。接管时只移除旧 Compose 容器/网络，**不得**使用 `-v` 或删除 bind-mount 目录，然后用 §5 的 production Compose 以 project `boxai` 启动 Postgres/Redis，再运行 Deploy production。

## 6. 验证与日常运维

```bash
ssh youbox

/opt/boxAI/current/deploy/scripts/production-compose.sh ps
curl -fsS http://127.0.0.1:8080/health
curl -fsS http://127.0.0.1:8081/healthz
curl -fsS https://you-box.com/health

# 从 current 读取实际部署 commit
cat /opt/boxAI/current/.boxai-commit

# 完整公网边界检查
/opt/boxAI/current/deploy/scripts/verify-topology.sh
```

验收信号：

- `sub2api`、`boxai-agent-gateway`、Postgres、Redis healthy；
- Agent `/healthz` 返回 `ready=true`、`hosted=true`、`multi_tenant=true`；
- apex 是 React；console 是 Go 内嵌 Vue 管理台；API 的 `/v1`、Agent WebUI/WS/gRPC 路由不互相吞流量；
- Creator 可完成隔离的 R2 PUT/complete/signed GET、跨设备同步和 tombstone；
- `migration 901_boxai_creator_cloud.sql` 已记录在 `schema_migrations`；
- `.env` 仍为 0600，Postgres/Redis 无公网端口。

重启应用（不动数据服务）：

```bash
/opt/boxAI/current/deploy/scripts/production-compose.sh restart sub2api agent-gateway
```

禁止生产后台“在线升级”替换二进制；禁止 `docker compose down -v` 或删除三个数据目录。

## 7. 回滚和备份

每次部署自动创建：

```text
/opt/boxAI/backups/deploy-<UTC>-<commit>/
  .env
  postgres.dump
  web.tar.gz
  nginx-you-box.com.conf
  previous-release 或 docker-compose.yml
```

部署中健康检查、静态发布或 Nginx 校验失败时自动回滚。部署完成后的业务回滚，重新部署已知良好的 commit：

```bash
gh workflow run deploy-production.yml -R fran0220/boxAI -f ref=<known-good-sha>
```

额外手工 DB 备份：

```bash
docker exec sub2api-postgres \
  pg_dump -U sub2api -d sub2api -Fc \
  > /root/boxai-$(date -u +%Y%m%dT%H%M%SZ).dump
```

迁移只允许 forward-only。回滚旧应用前先确认新迁移保持向后兼容；不要编辑已应用迁移。

## 8. 公开 Release 与生产部署分离

`.github/workflows/release.yml`、`vX.Y.Z-box.N` 和 `ghcr.io/fran0220/boxai` 继续服务于公开镜像/二进制/桌面产物，但**不是 youbox 生产上线前置**。生产修复无需打 tag、等待多架构构建或 push package。

| 目标 | 入口 |
|---|---|
| youbox 生产 | 手动 `Deploy production`，输入 commit |
| 公开 Docker / Go release | `release.yml` + `vX.Y.Z-box.N` |
| Desktop 安装包 | `desktop-release.yml` + desktop tag |

## 9. 安全基线

- Nginx 是唯一公网入口；应用仅 `127.0.0.1:8080/8081/50051`，Postgres/Redis不映射端口。
- `.env`、管理 API、R2 和 Cloudflare token 永不进入 Git/Actions artifact/日志。
- UI host 使用无 `Domain` 的 `__Host-boxai_session`；refresh 凭据不进 localStorage，access JWT 仅存内存。
- browser-session 请求要求 `X-BoxAI-CSRF: 1` 和精确同源 `Origin`；跨 host 登录只使用一次性 PKCE code。
- apex 只开放浏览器所需 API；console 全量反代；API host 不开放 browser-session endpoint。
- 上线前备份、上线后执行 topology smoke，并保留至少一个已知良好 commit 的本地 image/release。

## Customer shell flags

| Flag | Default | Notes |
|---|---|---|
| `BOXAI_BROWSER_SESSION` | on | Host-only session cookies |
| `BOXAI_LEGACY_BROWSER_ADOPTION` | off when drained | One-time legacy refresh import |
| `BOXAI_CONSOLE_ADMIN_SESSION_ONLY` | off | On 时非管理员不能 mint console cookie |
| `BOXAI_AUTH_TX` | off | Experimental auth transaction continue API |
| `VITE_CUSTOMER_SHELL_REDIRECT` | on for console host | 非管理员 console routes → apex |
