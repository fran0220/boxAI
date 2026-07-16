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
   ├─ you-box.com      React 静态 (/var/www/you-box.com) + 反代 /api /v1 /health → :8080
   ├─ www.you-box.com  301 → you-box.com
   ├─ console.you-box.com  反代全部 → :8080（Go 内嵌 Vue 控制台）
   └─ api.you-box.com  仅 /v1/*、SSO/desktop token、refresh、public settings、/health
          │
          ▼
   127.0.0.1:8080  Docker sub2api (ghcr.io/fran0220/boxai:<pin>)
          │
   Postgres 18 + Redis 8  (compose 同项目)
```

| 项 | 值 |
|----|-----|
| SSH | `ssh youbox` → `root@160.187.1.155` |
| 产品面 | `https://you-box.com`（营销 / Creator） |
| 控制台 | `https://console.you-box.com`（用户台 + 管理台） |
| 开发者 API | `https://api.you-box.com/v1` |
| 应用目录 | `/opt/boxAI` |
| React 静态 | `/var/www/you-box.com`（`web/dist`） |
| Compose | `/opt/boxAI/docker-compose.yml` |
| 环境文件 | `/opt/boxAI/.env`（`chmod 600`，**勿提交 Git**） |
| 公开镜像 | `ghcr.io/fran0220/boxai:<pin-tag>`（当前示例 `0.1.155-box.10`） |
| 应用监听 | 仅本机 `127.0.0.1:8080` |
| 健康检查 | `GET /health` → `{"status":"ok"}`（apex / console / api 均应可达） |
| Nginx 关键项 | **`http` 块**必须有 `underscores_in_headers on;` |
| 管理员 | `.env` 的 `ADMIN_EMAIL`；初始密码见 `/root/.boxai-admin-password` |

### 1.0 发布与验证

```bash
# React 产品面静态资源
./deploy/scripts/deploy-web-static.sh

# Nginx 多主机 + 证书
./deploy/scripts/apply-nginx-topology.sh

# HTTP 冒烟
./deploy/scripts/verify-topology.sh

# 应用镜像
ssh youbox 'cd /opt/boxAI && sed -i "s|^BOXAI_IMAGE=.*|BOXAI_IMAGE=ghcr.io/fran0220/boxai:<tag>|" .env \
  && docker compose pull sub2api && docker compose up -d --no-deps sub2api'
```

### 1.1 Compose 服务

三类服务同项目，状态应为 `healthy`：

| 服务 | 容器名 | 镜像 | 数据目录（宿主机） | 宿主机端口 |
|------|--------|------|-------------------|------------|
| 应用 | `sub2api` | `ghcr.io/fran0220/boxai:<tag>` | `/opt/boxAI/data` → 容器 `/app/data` | `127.0.0.1:8080` |
| PostgreSQL | `sub2api-postgres` | `postgres:18-alpine` | `/opt/boxAI/postgres_data` | **不映射**（仅 Docker 网络） |
| Redis | `sub2api-redis` | `redis:8-alpine` | `/opt/boxAI/redis_data` | **不映射** |

检查：

```bash
ssh youbox
cd /opt/boxAI
docker compose ps
curl -fsS http://127.0.0.1:8080/health
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

POSTGRES_USER=sub2api
POSTGRES_PASSWORD=<强随机>
POSTGRES_DB=sub2api

JWT_SECRET=<openssl rand -hex 32>
TOTP_ENCRYPTION_KEY=<openssl rand -hex 32>

ADMIN_EMAIL=admin@you-box.com
ADMIN_PASSWORD=<初始管理员密码>

AUTO_SETUP=true
```

| 变量 | 说明 |
|------|------|
| `BOXAI_IMAGE` | **生产禁止** `:latest`，pin 到具体 release tag |
| `JWT_SECRET` | 固定后勿随意轮换，否则全站登录失效 |
| `TOTP_ENCRYPTION_KEY` | 固定后勿随意轮换，否则 TOTP 密文不可解密 |
| `POSTGRES_PASSWORD` | DB 密码；与数据目录绑定 |
| `AUTO_SETUP=true` | 首次启动写配置、跑迁移、创建管理员 |

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
# 本机执行
./deploy/scripts/deploy-web-static.sh
./deploy/scripts/apply-nginx-topology.sh   # 含 certbot expand: you-box.com www console api
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

Docker 部署**禁止**使用管理后台「在线升级」替换二进制。只通过镜像 pin 升级：

```bash
cd /opt/boxAI
# 1) 备份（见 §6）
# 2) .env：BOXAI_IMAGE=ghcr.io/fran0220/boxai:<新 tag>
docker compose pull
docker compose up -d
curl -fsS http://127.0.0.1:8080/health
curl -fsS https://you-box.com/health
docker exec sub2api /app/sub2api -version | head -1
```

若只更新营销/Creator UI：`./deploy/scripts/deploy-web-static.sh`（不必换镜像）。

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

发布后把生产 `.env` 的 `BOXAI_IMAGE` 改为新 tag，再 `pull && up -d`。

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
| apex 不是 React | `/var/www/you-box.com` 是否有 `index.html`；`deploy-web-static.sh` |
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

---

## 11. 一页命令卡（线上常用）

```bash
ssh youbox
cd /opt/boxAI

docker compose ps
docker compose logs -f --tail=100 sub2api

# 升级
# vi .env   # BOXAI_IMAGE=...
docker compose pull && docker compose up -d
curl -fsS https://you-box.com/health

# 备份
docker exec sub2api-postgres pg_dump -U sub2api -d sub2api -Fc > /root/boxai-$(date +%F).dump
```
