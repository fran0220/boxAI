# CI/CD 与发布

本文档描述 **Desktop / Agent Gateway** 自动化发布链路，以及与 **BoxAI 生产托管 Relay** 的关系。

> BoxAI youbox 整站（Go 控制面 + React + compose 内 agent-gateway）的日常发版见仓库根文档：
> [`docs/PRODUCTION.md`](../../../docs/PRODUCTION.md) · [`docs/agents/deploy-release.md`](../../../docs/agents/deploy-release.md)
> （手动 **Deploy production** 选择 commit，生产机本地构建；与公开 Release/GHCR 分离。）

## 自动化入口

| 入口 | Workflow | 动作 |
|---|---|---|
| PR / `main` push | 仓库根 CI / desktop 相关 jobs | Gateway、WebUI、GUI、Tauri 测试等（以当前 `.github/workflows/*` 为准）。 |
| 手动选择 branch/tag/SHA | `deploy-production.yml` | youbox 从同一 commit 本地构建 Go API + hosted Relay，并发布 React。 |
| `v*` tag（BoxAI 产品） | `release.yml` | 发布公开 GHCR/Go artifacts；不触发生产部署。 |
| `v*` tag / 手动 | `desktop-release.yml` | 并行构建 macOS / Windows / Linux 桌面包，上传 GitHub Release。 |
| 用户自部署 Gateway | 根目录 `desktop/Dockerfile` 或独立镜像流 | 用户自有平台；与 youbox 托管 Relay 分离。 |

## Gateway 镜像

根目录 `Dockerfile` 是 Gateway 的生产镜像：

| 阶段 | 内容 |
|---|---|
| `webui` | 用 Node 22 和 pnpm 构建 `crates/agent-gateway/web/dist`。 |
| `gateway-builder` | 用 Go 编译 `cmd/gateway`，WebUI 静态资源通过 `go:embed` 打进二进制。 |
| `runtime` | Debian slim + CA certificates + `liveagent-gateway`，非 root 用户运行。 |

运行时变量：

| 变量 | 必填 | 说明 |
|---|---|---|
| `LIVEAGENT_GATEWAY_TOKEN` | Standalone 必填 | Standalone 的 WebUI、HTTP API、桌面 gRPC 共享 token；Hosted multi-tenant 且静态认证关闭时无需设置。 |
| `PORT` | Railway 自动提供 | HTTP/WebUI 监听端口，未提供时 Dockerfile 默认 `8080`。 |
| `LIVEAGENT_GATEWAY_GRPC_ADDR` | 否 | gRPC 监听地址，默认 `:50051`。 |
| `BOXAI_GATEWAY_AUTH_RECHECK_PERIOD` | 否 | Hosted JWT 长连接重验证周期，默认 `1m`；过期、撤销或用户归属变化后关闭 WS/gRPC 并要求客户端重连。 |
| `BOXAI_SERVER_URL` | 否 | boxAI 服务端地址；设置后接受 boxAI 账号 JWT（经 `/api/v1/auth/me` 校验）。 |
| `BOXAI_GATEWAY_MULTI_TENANT` | 否 | `true` 时按 boxAI 账号隔离会话（Hosted Relay，需同时设置 `BOXAI_SERVER_URL`）；静态 token 默认拒绝。默认关闭，Standalone 行为不变。 |
| `BOXAI_GATEWAY_ALLOW_HOSTED_STATIC_TOKEN` | 否 | 高风险 break-glass 开关；仅明确设为 `true` 才允许 Hosted 模式静态 token 进入共享 `local` 租户。默认 `false`。 |
| `LIVEAGENT_GATEWAY_RELAY_BUFFER_SECONDS` | 否 | conversation replay 的按时间保留窗口，默认 `30` 秒；4096 条与约 8 MiB 上限始终同时生效。 |
| `LIVEAGENT_GATEWAY_CHAT_PREPARE_TIMEOUT` | 否 | `chat.prepare` 与 command accepted 前关联原生 Ping/Pong 的最大等待时间，默认 `2s`。 |
| `LIVEAGENT_GATEWAY_CHAT_DELIVERY_TIMEOUT` | 否 | accepted 后把 `ChatCommandRequest` 投递到当前桌面 Agent stream 的最大等待时间，默认 `5s`。 |
| `LIVEAGENT_GATEWAY_CHAT_START_TIMEOUT` | 否 | Chat command 进入桌面运行态的第一段 watchdog，默认 `5s`。 |
| `LIVEAGENT_GATEWAY_CHAT_RENDER_START_TIMEOUT` | 否 | 第一段 watchdog 后继续等待桌面 run settled 的附加窗口，默认 `10s`。 |

本地 smoke run 示例：

```bash
make gateway-docker-smoke
```

CI 中的 `Gateway Docker Smoke` job 会执行同等检查：构建镜像、启动容器、访问 `/healthz`。

生产容器同时监听明文 HTTP/WebSocket `8080` 与明文 gRPC `50051`。TLS 应由可信反向代理/负载均衡器终止，并分别将 HTTP/1.1 Upgrade 流量转发到 `8080`、HTTP/2 gRPC 流量转发到 `50051`；不要把这两个容器端口直接暴露到公网。

Hosted Relay 最小环境（youbox compose 已注入等价变量）：

```dotenv
PORT=8080
LIVEAGENT_GATEWAY_GRPC_ADDR=:50051
BOXAI_SERVER_URL=http://sub2api:8080
# 公网身份校验走内网控制面，勿 hairpin 公网 apex
BOXAI_GATEWAY_MULTI_TENANT=true
BOXAI_GATEWAY_ALLOW_HOSTED_STATIC_TOKEN=false
BOXAI_GATEWAY_AUTH_RECHECK_PERIOD=1m
LIVEAGENT_GATEWAY_RELAY_BUFFER_SECONDS=120
```

`/healthz` 仅返回 `ok`、`ready`、`hosted`、`multi_tenant` 布尔信号，不返回 token、服务端 URL 或租户信息。Hosted 部署应要求 `ready=true`、`hosted=true`、`multi_tenant=true`。

## BoxAI 托管 Relay 与用户自部署 Gateway

BoxAI 生产在 **youbox compose** 运行 `boxai-agent-gateway`，边缘由 `api.you-box.com` 终止 TLS（WebUI/WS → `:8081`，gRPC → `:50051`）。Relay 与主 Go API 从同一个部署 commit 在生产机本地构建，不依赖 `BOXAI_AGENT_GATEWAY_IMAGE` 或 GHCR。

需要独立部署或自定义域名的用户仍可用自己的 Railway 账号部署本仓库，或在其他 Docker 平台部署固定版本镜像（Standalone + `LIVEAGENT_GATEWAY_TOKEN`）。

Railway 自部署路径：

1. 在 Railway 新建项目，选择 GitHub Repository。
2. 选择 `fran0220/boxAI` 或用户自己的 fork。
3. 分支选择包含根目录 `Dockerfile` 和 `railway.json` 的分支。
4. 在 service variables 中设置 `LIVEAGENT_GATEWAY_TOKEN=<long-random-token>`。
5. 保持 `LIVEAGENT_GATEWAY_GRPC_ADDR=:50051`，或按平台 TCP Proxy 要求调整。
6. 部署成功后生成 Public Domain，并访问 `/healthz` 验证健康检查。

推荐生产部署模型：

| 流量 | Railway 能力 | Remote 配置 |
|---|---|---|
| WebUI / HTTP / WebSocket | Public Networking HTTPS 域名 | `Gateway URL=https://<service>.up.railway.app` |
| 桌面端 gRPC | TCP Proxy | `gRPC Endpoint=http://<tcp-proxy-host>:<tcp-proxy-port>` |

Gateway WebUI 和桌面 gRPC 地址分开后，Railway 的 HTTPS 域名和 TCP Proxy 地址可以独立配置。

Gateway 运行时变量由用户在自己的平台配置：

| 变量 | 说明 |
|---|---|
| `LIVEAGENT_GATEWAY_TOKEN` | WebUI、HTTP API、桌面 gRPC 的共享访问 token。 |
| `LIVEAGENT_GATEWAY_GRPC_ADDR` | 保持 `:50051`，供 Railway TCP Proxy 转发。 |
| `LIVEAGENT_GATEWAY_CHAT_PREPARE_TIMEOUT` | 默认 `2s`；通常无需调大，超时应暴露半开连接并让客户端快速恢复。 |
| `LIVEAGENT_GATEWAY_CHAT_DELIVERY_TIMEOUT` | 默认 `5s`；控制 accepted 后投递桌面 stream 的上限。 |
| `LIVEAGENT_GATEWAY_CHAT_START_TIMEOUT` | 默认 `5s`；控制远程 command 启动 watchdog 的第一阶段。 |
| `LIVEAGENT_GATEWAY_CHAT_RENDER_START_TIMEOUT` | 默认 `10s`；控制启动 watchdog 的附加阶段。 |

Gateway 的 conversation stream replay 与 `client_request_id` 去重当前都是进程内有界状态，不需要 SQLite 持久卷。事件窗口按 `LIVEAGENT_GATEWAY_RELAY_BUFFER_SECONDS`（默认 30 秒）保留，并始终限制为最多 4096 条或约 8 MiB；command 去重记录保留 24 小时，但 Gateway 进程重启后不会保留。

## GitHub Secrets

macOS signed/notarized release 需要这些 secrets：

| Secret | 说明 |
|---|---|
| `APPLE_CERTIFICATE_P12_BASE64` | Developer ID Application `.p12` 的 base64。 |
| `APPLE_CERTIFICATE_PASSWORD` | 导出 `.p12` 时设置的密码。 |
| `APPLE_SIGNING_IDENTITY` | `Developer ID Application: wenlin fei (UU94JSVAA9)`。 |
| `APPLE_ID` | Apple Developer 账号邮箱。 |
| `APPLE_TEAM_ID` | `UU94JSVAA9`。 |
| `APPLE_APP_SPECIFIC_PASSWORD` | Apple app-specific password。 |
| `TAURI_SIGNING_PRIVATE_KEY` | Tauri updater 私钥，用于生成 release 更新包签名。 |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Tauri updater 私钥密码；无密码时可为空。 |
| `TAURI_UPDATER_PUBLIC_KEY` | Tauri updater 公钥，会编译进桌面端用于校验更新包。 |

脚本化写入 GitHub 配置：

```bash
BOOTSTRAP_APPLE_SECRETS=1 \
APPLE_CERTIFICATE_PASSWORD=<p12-export-password> \
  scripts/release/bootstrap-github-secrets.sh
```

如果 `CERT_DIR/developer_id_application.p12` 不存在，脚本会从本机 Keychain 中的 `Developer ID Application: wenlin fei (UU94JSVAA9)` 自动导出，并生成 `.p12` 密码写入 GitHub Secret。`CERT_DIR` 默认优先使用 `~/Personal/cert`，不存在时使用 `~/Downloads/cert`。已有 `.p12` 时需要传入 `APPLE_CERTIFICATE_PASSWORD=<p12-password>`。

如果自动导出失败，先确认本机能看到可签名 identity：

```bash
security find-identity -v -p codesigning "$HOME/Library/Keychains/login.keychain-db"
```

Keychain 中必须是带私钥的 `Developer ID Application` identity。若 macOS 拒绝私钥导出，可以在 Keychain Access 中手动导出 `.p12` 到 `P12_PATH`，再用同一个 `APPLE_CERTIFICATE_PASSWORD` 重新运行脚本。

脚本默认读取：

| 文件 | 用途 |
|---|---|
| `CERT_DIR/developer_id_application.p12` | CI 导入的签名 identity。 |
| `CERT_DIR/app key.md` | Apple app-specific password。 |

## 桌面产物

`desktop-release.yml` 产物：

| 平台 | Runner | 产物 |
|---|---|---|
| macOS Intel | `macos-15-intel` | `BoxAI-vX.Y.Z-macOS-x64.dmg`，以及 updater 使用的 `.app.tar.gz` / `.sig`。 |
| macOS Apple Silicon | `macos-14` | `BoxAI-vX.Y.Z-macOS-aarch64.dmg`，以及 updater 使用的 `.app.tar.gz` / `.sig`。 |
| Windows x64 | `windows-latest` | `BoxAI-vX.Y.Z-Windows-x64.msi`、`BoxAI-vX.Y.Z-Windows-x64-Setup.exe`，以及 updater 使用的 `.zip` / `.sig`。 |
| Linux x64 | `ubuntu-latest` | `BoxAI-vX.Y.Z-Linux-x86_64.AppImage`、`.deb`、`.rpm`，以及 updater 使用的 `.tar.gz` / `.sig`。 |

发布 job 会在上传平台产物后生成并上传 `latest.json`。桌面端「设置 -> 关于」会根据用户是否允许预发布，从 GitHub Releases 中筛选带 `latest.json` 的正式 / 预发布版本；未允许预发布时只检查正式 Release。

## 桌面版本号来源

本地开发和普通本机构建只维护一个默认版本源：`crates/agent-gui/package.json`。Tauri 默认配置、前端 About 页和 Rust 运行时代码都会从这里读取版本，因此日常开发不需要到多个文件里同步版本号。

正式发布时不依赖人工修改 `package.json`。`desktop-release.yml` 会先在 `Release Metadata` job 中解析 release tag：

```bash
node scripts/release/prepare-app-version-from-tag.mjs vX.Y.Z
```

这个脚本会校验 tag 必须是 `v` 开头的 semver，输出：

| 输出 | 示例 | 用途 |
|---|---|---|
| `LIVEAGENT_RELEASE_TAG` | `v0.1.3` | GitHub Release、产物命名和下载 URL。 |
| `LIVEAGENT_APP_VERSION` | `0.1.3` | 前端 About 页和 Rust 运行时代码。 |
| `LIVEAGENT_IS_PRERELEASE` | `false` | 决定 GitHub Release 是否标记为 prerelease。 |
| `LIVEAGENT_TAURI_VERSION_CONFIG` | `src-tauri/tauri.version.generated.conf.json` | Tauri 构建时追加的临时 config overlay。 |

各平台构建 job 会复用同一份 metadata，并生成一个未提交到仓库的 Tauri overlay：

```json
{
  "version": "0.1.3"
}
```

Tauri 构建命令通过额外的 `--config "$LIVEAGENT_TAURI_VERSION_CONFIG"` 注入这个版本；Vite 和 Rust build script 通过 `LIVEAGENT_APP_VERSION` 注入同一个版本。这样发布版本以 tag 为事实来源，updater manifest、应用内显示版本和安装包版本会保持一致；忘记改 `package.json` 不会导致发布包仍显示旧版本。

Windows 当前没有代码签名 secret，release workflow 会先自动发布 unsigned 包。接入 Windows `.p12/.pfx` 或 Trusted Signing 后再补签名步骤。
