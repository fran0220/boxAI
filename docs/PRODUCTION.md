# BoxAI 生产部署文档（完整版）

本文描述 **当前线上** 与 **从零重建** 的完整部署方式。  
产品仓库：`fran0220/boxAI` · 公开镜像：`ghcr.io/fran0220/boxai`

---

## 1. 生产拓扑

> 架构：[`docs/WEB_PLATFORM.md`](./WEB_PLATFORM.md) · 本地：[`docs/LOCAL_DEV.md`](./LOCAL_DEV.md)  
> Nginx：[`deploy/nginx-you-box.com.conf`](../deploy/nginx-you-box.com.conf) · Caddy：[`deploy/Caddyfile.you-box.com`](../deploy/Caddyfile.you-box.com)

```
Internet
   │
   ├─ you-box.com      React 静态 + 浏览器 API 白名单 + /v1 /health → :8080
   ├─ www.you-box.com  301 → you-box.com
   ├─ console.you-box.com  反代全部 → :8080（Go 内嵌 Vue 控制台）
   └─ api.you-box.com  /v1 + desktop token → :8080；Agent WebUI/WS → :8081；gRPC → :50051
          │
          ├─ 127.0.0.1:8080  Docker sub2api (ghcr.io/fran0220/boxai:<pin>)
          └─ 127.0.0.1:8081 + :50051  hosted Agent Relay (per-account)
          │
   Postgres 18 + Redis 8  (compose 同项目)
```

| 项 | 值 |
|----|-----|
| SSH | `ssh youbox` → `root@160.187.1.155` |
| 产品面 | `https://you-box.com`（营销 / Creator） |
| 控制台 | `https://console.you-box.com`（用户台 + 管理台） |
| 开发者 API / Agent Relay | `https://api.you-box.com/v1` / `https://api.you-box.com`（WebUI、WSS、gRPC TLS） |
| 应用目录 | `/opt/boxAI` |
| React 静态 | `/var/www/you-box.com`（`web/dist`） |
| Compose | `/opt/boxAI/docker-compose.yml` |
| 环境文件 | `/opt/boxAI/.env`（`chmod 600`，**勿提交 Git**） |
| 公开镜像 | `ghcr.io/fran0220/boxai:<pin-tag>`（当前示例 `0.1.155-box.10`） |
| 应用监听 | 仅本机 `127.0.0.1:8080` |
| 健康检查 | 主服务 `GET /health`；Agent Relay `GET /healthz`（应为 hosted + multi_tenant ready） |
| Nginx 关键项 | **`http` 块**必须有 `underscores_in_headers on;` |
| 管理员 | `.env` 的 `ADMIN_EMAIL`；初始密码见 `/root/.boxai-admin-password` |
| **管理 API** | **仅** `https://console.you-box.com/api/v1/admin/*`（apex `you-box.com` 会 404 管理接口） |
| 运维密钥文件 | 服务器 `/root/.boxai/admin-api.env`（`chmod 600`；本机 `~/.config/boxai/admin.env`；**勿提交 Git**） |

**系统配置变更（SMTP、邮件验证、站点开关等）优先用管理 API**（`x-api-key`），不要手改 DB / 容器内文件：

```bash
# 服务器
set -a && source /root/.boxai/admin-api.env && set +a
# 本机
# set -a && source ~/.config/boxai/admin.env && set +a

curl -sS "$SUB2API_BASE_URL/api/v1/admin/settings" -H "x-api-key: $SUB2API_ADMIN_API_KEY"
# 写配置：先 GET 全量 → 改字段 → PUT 回写（避免部分字段把其它设置清零）
# SMTP 测试：POST /api/v1/admin/settings/test-smtp
# 测试邮件：POST /api/v1/admin/settings/send-test-email  body.email=...
```

邮件发信：Cloudflare Email Sending（域名 `you-box.com`）。SMTP 见后台 settings（`smtp.mx.cloudflare.net:465`，用户名字面量 `api_token`，密码为 `CLOUDFLARE_API_TOKEN`）。

### 1.0 发布与验证（主路径：GitHub Actions）

**日常上线只走 CI**，不要本机拼装 `rsync` + SSH `sed` 镜像 pin。

| 步骤 | 做什么 |
|------|--------|
| 1 | `main` CI 绿（`backend-ci` + `fork-gates`） |
| 2 | 打产品 tag：`vX.Y.Z-box.N` 并 push |
| 3 | **Release** workflow 推送 `ghcr.io/fran0220/boxai:<version>`（version **无** `v` 前缀） |
| 4 | **Deploy production** 自动跟跑（或手动 `workflow_dispatch`）→ pin 镜像 + 构建/发布 `web/` + `verify-topology` |

```bash
# 正常发版
git tag v0.1.155-box.11 && git push origin v0.1.155-box.11
# 打开 Actions：Release → Deploy production

# 只更新 apex React（不换 API 镜像）
gh workflow run deploy-production.yml -R fran0220/boxAI -f mode=web

# 只升 API / Agent（已有镜像）
gh workflow run deploy-production.yml -R fran0220/boxAI \
  -f mode=app -f image_tag=0.1.155-box.11

# 回滚：对上一个绿 tag 再跑一次 full/app
gh workflow run deploy-production.yml -R fran0220/boxAI \
  -f mode=full -f image_tag=0.1.155-box.10
```

**GitHub 配置（一次性）**

| 类型 | 名 | 说明 |
|------|-----|------|
| Environment | `production` | Deploy job 使用；可开审批 |
| Secret | `DEPLOY_SSH_KEY` | 部署专用私钥 |
| Secret | `DEPLOY_HOST` | 如 `160.187.1.155` |
| Secret | `DEPLOY_USER` | 如 `root` 或 `deploy` |
| Var（可选） | `DEPLOY_APP_DIR` | 默认 `/opt/boxAI` |
| Var（可选） | `DEPLOY_DOCROOT` | 默认 `/var/www/you-box.com` |

编排脚本：[`deploy/scripts/ci-deploy.sh`](../deploy/scripts/ci-deploy.sh) · 工作流：[`.github/workflows/deploy-production.yml`](../.github/workflows/deploy-production.yml)。

**禁止**：生产 `BOXAI_IMAGE=:latest`；Deploy **不** `compose down -v`、**不**动 Postgres/Redis 数据卷。

**低频 / 急救（非主路径）**

| 场景 | 命令 |
|------|------|
| Nginx / 证书 | `./deploy/scripts/apply-nginx-topology.sh` |
| 本机急救静态站 | `./deploy/scripts/deploy-web-static.sh`（会打印警告） |
| 本机冒烟 | `./deploy/scripts/verify-topology.sh` |

### 1.1 Compose 服务

四类服务同项目，状态应为 `healthy`：

| 服务 | 容器名 | 镜像 | 数据目录（宿主机） | 宿主机端口 |
|------|--------|------|-------------------|------------|
| 应用 | `sub2api` | `ghcr.io/fran0220/boxai:<tag>` | `/opt/boxAI/data` → 容器 `/app/data` | `127.0.0.1:8080` |
| Agent Relay | `boxai-agent-gateway` | `ghcr.io/fran0220/boxai-agent-gateway:<tag>` | 无持久卷（有界 replay） | `127.0.0.1:8081` + `127.0.0.1:50051` |
| PostgreSQL | `sub2api-postgres` | `postgres:18-alpine` | `/opt/boxAI/postgres_data` | **不映射**（仅 Docker 网络） |
| Redis | `sub2api-redis` | `redis:8-alpine` | `/opt/boxAI/redis_data` | **不映射** |

检查：

```bash
ssh youbox
cd /opt/boxAI
docker compose ps
curl -fsS http://127.0.0.1:8080/health
curl -fsS http://127.0.0.1:8081/healthz
curl -fsS https://you-box.com/health
docker exec sub2api-postgres pg_isready -U sub2api -d sub2api
docker exec sub2api-redis redis-cli ping   # 期望 PONG
```

---

## 2. 目录与文件约定

```text
/opt/boxAI/
├── .env                      # 密钥与镜像 pin（600）
├── .env.example              # 模板（可从仓库同步）
├── docker-compose.yml        # 生产使用的 compose（= docker-compose.local.yml）
├── docker-compose.local.yml  # 与仓库同步的副本
├── data/                     # 应用数据、config、安装锁、日志
├── postgres_data/            # PostgreSQL 数据文件
└── redis_data/               # Redis AOF/RDB
```

容器名 / 二进制 / 数据库名：`sub2api`（模块路径不变）。对外产品名：**BoxAI**；镜像：`ghcr.io/fran0220/boxai`。

---

## 3. 环境变量（最小必填）

`/opt/boxAI/.env` 至少包含：

```bash
BOXAI_IMAGE=ghcr.io/fran0220/boxai:0.1.155-box.10
BIND_HOST=127.0.0.1
SERVER_PORT=8080
SERVER_MODE=release
# Only the private Docker bridge may supply X-Forwarded-For to the backend.
SERVER_TRUSTED_PROXIES=172.16.0.0/12

POSTGRES_USER=sub2api
POSTGRES_PASSWORD=<强随机>
POSTGRES_DB=sub2api

JWT_SECRET=<openssl rand -hex 32>
TOTP_ENCRYPTION_KEY=<openssl rand -hex 32>

ADMIN_EMAIL=admin@you-box.com
ADMIN_PASSWORD=<初始管理员密码>

AUTO_SETUP=true

JWT_ACCESS_TOKEN_EXPIRE_MINUTES=15
BOXAI_BROWSER_SESSION=true
# 仅在仍有旧 localStorage refresh 需要一次性 adopt 时设 true；默认 false
BOXAI_LEGACY_BROWSER_ADOPTION=false
# BOXAI_WEB_SSO 已退役，忽略

# Creator cloud: metadata in Postgres, binary objects in private R2
BOXAI_CREATOR_CLOUD_ENABLED=true
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_REGION=auto
R2_BUCKET=<private-bucket>
R2_ACCESS_KEY_ID=<r2-access-key>
R2_SECRET_ACCESS_KEY=<r2-secret-key>

# Hosted Agent Relay (identity remains in the BoxAI backend)
BOXAI_AGENT_GATEWAY_IMAGE=ghcr.io/fran0220/boxai-agent-gateway:<pin-tag>
BOXAI_AGENT_GATEWAY_AUTH_URL=http://sub2api:8080
BOXAI_GATEWAY_AUTH_RECHECK_PERIOD=1m
LIVEAGENT_GATEWAY_RELAY_BUFFER_SECONDS=120
```

| 变量 | 说明 |
|------|------|
| `BOXAI_IMAGE` | **生产禁止** `:latest`，pin 到具体 release tag |
| `SERVER_TRUSTED_PROXIES` | 仅信任 Docker 私网代理链，避免所有公网用户共享宿主机限流桶；Nginx 会校验并规范化 Cloudflare 真实 IP |
| `JWT_SECRET` | 固定后勿随意轮换，否则全站登录失效 |
| `TOTP_ENCRYPTION_KEY` | 固定后勿随意轮换，否则 TOTP 密文不可解密 |
| `POSTGRES_PASSWORD` | DB 密码；与数据目录绑定 |
| `AUTO_SETUP=true` | 首次启动写配置、跑迁移、创建管理员 |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES=15` | 浏览器内存 access JWT 的短有效期；优先于 `JWT_EXPIRE_HOUR` |
| `BOXAI_BROWSER_SESSION` | 启用每个 UI host 独立的 `__Host-boxai_session` |
| `BOXAI_LEGACY_BROWSER_ADOPTION` | 迁移期一次性接收旧 localStorage refresh token；compose/example 与 Go 进程在 **未设置** 时均默认 `false`，仅排水期显式写 `true` |
| `BOXAI_CREATOR_CLOUD_ENABLED` + `R2_*` | Creator 元数据启用 Postgres 权威源；二进制仅进 private R2，不公开 bucket。细节：[CREATOR_CLOUD.md](./CREATOR_CLOUD.md) |
| `BOXAI_AGENT_GATEWAY_IMAGE` | Hosted Relay 固定镜像；按用户 ID 隔离，生产禁止静态共享 token |

完整变量表见仓库 `deploy/.env.example`。

---

## 4. 从零部署（新机器）

### 4.1 前置

- Linux x86_64 或 arm64
- Docker Engine + Compose v2
- 公网 80/443（TLS）
- DNS：`you-box.com` → 服务器 IP

### 4.2 安装 Docker（若无）

按官方文档安装 Docker Engine，确保非 root 或 root 可执行 `docker compose`。

### 4.3 放置应用目录

```bash
mkdir -p /opt/boxAI && cd /opt/boxAI

# 从仓库取 compose 与 env 模板（公共仓库 raw）
curl -fsSL -o docker-compose.yml \
  https://raw.githubusercontent.com/fran0220/boxAI/main/deploy/docker-compose.local.yml
curl -fsSL -o .env.example \
  https://raw.githubusercontent.com/fran0220/boxAI/main/deploy/.env.example

cp .env.example .env
chmod 600 .env
# 编辑 .env：生成密钥、pin BOXAI_IMAGE、设置 ADMIN_*
```

生成密钥示例：

```bash
echo "JWT_SECRET=$(openssl rand -hex 32)"
echo "TOTP_ENCRYPTION_KEY=$(openssl rand -hex 32)"
echo "POSTGRES_PASSWORD=$(openssl rand -hex 16)"
```

```bash
mkdir -p data postgres_data redis_data
```

### 4.4 启动

```bash
cd /opt/boxAI
docker compose pull
docker compose up -d
docker compose ps
# 等待 healthy
curl -fsS http://127.0.0.1:8080/health
```

### 4.5 Nginx + TLS

#### 4.5.1 必配：`http` 块开启下划线请求头

反向代理 BoxAI/Sub2API（以及配合 Codex CLI / 多账号粘性会话）时，**必须**在 Nginx 的 **`http { }` 块**（不是 `server` 块）中配置：

```nginx
http {
    # 保留名称含下划线的请求头（如 session_id）
    # Nginx 默认会丢弃这类头，导致粘性会话失效
    underscores_in_headers on;

    # ... 其余配置
}
```

线上文件位置：`/etc/nginx/nginx.conf` 的 `http` 块内。  
修改后：`nginx -t && systemctl reload nginx`。

#### 4.5.2 多主机站点配置

完整配置见仓库 **`deploy/nginx-you-box.com.conf`**（apex React + console Vue + api 过滤）。

```bash
# 首次上机：Nginx + 证书（低频）
./deploy/scripts/apply-nginx-topology.sh   # certbot expand: you-box.com www console api
# React 首发或急救（生产日常请用 Actions Deploy production → mode=web|full）
./deploy/scripts/deploy-web-static.sh
./deploy/scripts/verify-topology.sh
```

证书路径：`/etc/letsencrypt/live/you-box.com/`。React 文档根：`/var/www/you-box.com`。

### 4.6 验收清单

- [ ] `docker compose ps` 三个服务均为 healthy / running  
- [ ] `curl http://127.0.0.1:8080/health` → ok  
- [ ] `curl https://you-box.com/health` → ok（React 边缘代理）  
- [ ] `curl https://console.you-box.com/health` → ok  
- [ ] `curl https://api.you-box.com/health` → ok  
- [ ] `you-box.com/` 为 React（含 `id="root"`）  
- [ ] `console.you-box.com` 可登录管理/用户台  
- [ ] `./deploy/scripts/verify-topology.sh` 通过  
- [ ] apex 登录/注册/admin API 为边缘 `404`；API host browser-session 为 `404`
- [ ] 三个 HTTPS host 均返回 HSTS、nosniff、frame deny、referrer、Permissions-Policy、CSP
- [ ] 磁盘：`df -h` 有余量；数据目录在 `/opt/boxAI/{data,postgres_data,redis_data}`

---

## 5. 日常运维

### 5.1 查看状态 / 日志

```bash
cd /opt/boxAI
docker compose ps
docker compose logs -f --tail=200 sub2api
docker compose logs --tail=100 postgres redis
```

### 5.2 升级

Docker 部署**禁止**使用管理后台「在线升级」替换二进制。

**主路径（推荐）**：打 tag → Actions **Release** → **Deploy production**（见 §1.0）。

**急救（SSH，仅当 Actions 不可用）**：

```bash
# 1) 备份（见 §6）
# 2) 在有仓库检出的机器上：
export DEPLOY_HOST=… DEPLOY_USER=… DEPLOY_SSH_KEY_PATH=…
MODE=full IMAGE_TAG=0.1.155-box.11 ./deploy/scripts/ci-deploy.sh
# 或 MODE=app / MODE=web
```

不要手改生产 `.env` 的镜像 pin 后忘记 `pull`；**不要** `docker compose down -v`。

环境变量（compose 默认已设）：

| 变量 | 默认 | 含义 |
|------|------|------|
| `BOXAI_DISABLE_INPLACE_UPDATE` | `true` | 禁止 Docker 内就地换二进制 |
| `UPDATE_GITHUB_REPO` | `fran0220/boxAI` | 版本检查来源（勿设为 Wei-Shaw/sub2api） |

若误点升级导致变回 Sub2API，在未改镜像 tag 的情况下：

```bash
cd /opt/boxAI
docker compose up -d --force-recreate --no-deps sub2api
```

迁移在应用启动时 **自动** 执行（forward-only）。不要跳过大版本；不要改已应用的 SQL 迁移文件。

### 5.3 重启

```bash
cd /opt/boxAI
docker compose restart
# 或
docker compose up -d --force-recreate
```

### 5.4 停机（不删数据）

```bash
cd /opt/boxAI
docker compose stop
# 或
docker compose down     # 不删 ./postgres_data ./redis_data ./data
```

**禁止**在例行维护中执行 `docker compose down -v` 或 `rm -rf postgres_data`。

---

## 6. 备份与恢复

### 6.1 逻辑备份（推荐）

```bash
cd /opt/boxAI
TS=$(date +%Y%m%d%H%M%S)
mkdir -p /root/boxai-backups

docker exec sub2api-postgres \
  pg_dump -U sub2api -d sub2api -Fc \
  > /root/boxai-backups/sub2api-${TS}.dump

tar czf /root/boxai-backups/data-${TS}.tgz -C /opt/boxAI data
# Redis 可选：停写窗口短时可 tar redis_data
tar czf /root/boxai-backups/redis-${TS}.tgz -C /opt/boxAI redis_data
```

### 6.2 整目录备份（含 PG 文件）

先 `docker compose stop`，再打包 `/opt/boxAI`（含 `postgres_data`），再 `docker compose up -d`。

### 6.3 恢复要点

1. 停应用  
2. 恢复 `postgres_data` 或 `pg_restore` 进空库  
3. 恢复 `data/`（含 config / 安装锁）  
4. `.env` 中密钥与备份时一致  
5. `docker compose up -d`

---

## 7. 公开发版镜像（仓库侧）

| 项 | 标准 |
|----|------|
| 镜像 | `ghcr.io/fran0220/boxai`（**public**） |
| Git tag | `vX.Y.Z-box.N`（`X.Y.Z` = 已合入上游基线） |
| 触发 | `git push origin vX.Y.Z-box.N` → `.github/workflows/release.yml` |
| 多架构 | amd64 + arm64（**full**） |

### 7.1 快速发版 vs 完整发版

| 模式 | 用途 | 大概耗时 | 产物 |
|------|------|----------|------|
| **simple（推荐日常/hotfix）** | youbox 生产（x86_64）紧急修复 | **约 5–10 分钟** | 仅 `linux/amd64` GHCR 镜像 + GitHub Release 文案 |
| **full** | 正式对外 / 需要 arm64（Apple 等） | **约 12–20+ 分钟** | amd64+arm64 镜像 manifest + 多平台二进制包 |

**日常生产升级请用 simple**，不必等 full 多架构：

```bash
# 方式 A：workflow_dispatch（推荐）
gh workflow run release.yml -R fran0220/boxAI \
  -f tag=v0.1.155-box.3 \
  -f simple_release=true

# 方式 B：仓库变量长期默认 simple（仅当生产只需 amd64 时）
# gh variable set SIMPLE_RELEASE -R fran0220/boxAI --body true
```

注意：`simple_release` 推送的 `ghcr.io/fran0220/boxai:latest` 与 version tag **只有 amd64**；若还要 arm64，再跑一次 full（同 tag 需删掉后重发，或打新 tag）。

Release 成功后由 **Deploy production** 自动 pin 并上线；也可 `workflow_dispatch` 指定 `image_tag`。  
**不要**再以「手改 `.env` + pull」作为文档主路径。

工程门禁与分支策略见：

- [AGENTS.md](../AGENTS.md)
- [docs/agents/deploy-release.md](./agents/deploy-release.md)
- [docs/agents/upstream-sync.md](./agents/upstream-sync.md)

---

## 8. 与其它主机的边界

| 主机 | 产品 | 仓库 | 镜像 |
|------|------|------|------|
| **youbox** | **BoxAI** | `fran0220/boxAI` | `ghcr.io/fran0220/boxai` |
| **bwg** / api.origingame.dev | Origin Gateway | `fran0220/you-box` | `ghcr.io/fran0220/you-box` |

不要把其它产品镜像部署到 youbox。

---

## 9. 故障排查速查

| 现象 | 排查 |
|------|------|
| 公网 502 | `docker compose ps`；Nginx 是否指向 `127.0.0.1:8080`；`nginx -t && systemctl reload nginx` |
| `/health` 失败 | `docker compose logs sub2api`；postgres/redis 是否 healthy |
| apex 不是 React | `/var/www/you-box.com` 是否有 `index.html`；重跑 Deploy `mode=web` 或急救 `deploy-web-static.sh` |
| 控制台打不开 | DNS `console.you-box.com`；证书是否含 console |
| 登录全失效 | 是否改过 `JWT_SECRET` |
| 迁移失败 | 日志中 migration 错误；先备份再处理 |
| 磁盘满 | `du -sh /opt/boxAI/*`；`docker image prune`（勿删当前 pin） |

---

## 10. 安全基线

- `.env` 权限 `600`，仅 root/运维可读  
- 应用只绑 `127.0.0.1:8080`，经 Nginx TLS 出口  
- Postgres / Redis **不**映射到公网  
- 生产 pin 镜像 digest 或具体 tag  
- 定期 `pg_dump`；升级前必备份  
- UI host 各自使用无 `Domain` 的 `__Host-boxai_session`；refresh 凭据不进 localStorage，access JWT 仅存内存
- browser-session 请求必须发送 `X-BoxAI-CSRF: 1` 和精确同源 `Origin`；跨 host 登录只用一次性 PKCE code
- apex 只开放浏览器所需 API；console 全量反代；`api.you-box.com` 不开放 browser-session endpoint

### Browser-session 发布与回滚

先发布后端/迁移和边缘白名单，再发布 Vue 镜像与 React 静态资源。迁移期保持
`BOXAI_LEGACY_BROWSER_ADOPTION=true`，客户端成功采用旧 refresh token 后必须删除
旧 localStorage 凭据。观察采用率后设为 `false` 并重建应用容器。回滚时先回滚
前端且暂留 adoption；紧急回滚后端可设 `BOXAI_BROWSER_SESSION=false`，可能要求用户
重新登录，但不可通过重新开放 apex credential/admin API 或 API-host session API 回滚。

---

## 11. 一页命令卡

```bash
# —— 发布（本机 / CI）——
git tag v0.1.x-box.N && git push origin v0.1.x-box.N
# Actions: Release → Deploy production

gh workflow run deploy-production.yml -R fran0220/boxAI -f mode=web
gh workflow run deploy-production.yml -R fran0220/boxAI -f mode=app -f image_tag=0.1.x-box.N

# —— 线上查看（SSH）——
ssh youbox
cd /opt/boxAI
docker compose ps
docker compose logs -f --tail=100 sub2api
curl -fsS https://you-box.com/health

# 备份
docker exec sub2api-postgres pg_dump -U sub2api -d sub2api -Fc > /root/boxai-$(date +%F).dump
```


## Customer shell flags (BoxAI)

| Flag | Default | Notes |
|------|---------|-------|
| `BOXAI_BROWSER_SESSION` | on | Host-only session cookies |
| `BOXAI_LEGACY_BROWSER_ADOPTION` | off when drained | One-time legacy refresh import |
| `BOXAI_CONSOLE_ADMIN_SESSION_ONLY` | off | When on, non-admin cannot mint console cookies (breaks WeChat MP console re-login) |
| `BOXAI_AUTH_TX` | off | Experimental auth transaction continue API |
| `VITE_CUSTOMER_SHELL_REDIRECT` | on for console host | Non-admin console routes → apex |
