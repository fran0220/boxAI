#!/usr/bin/env bash
# Production deploy orchestrator for GitHub Actions (or emergency local use).
#
# Primary path: Actions → this script → SSH (compose pin/up) + rsync (web/).
# Postgres/Redis stay on the host compose project and are never recreated here.
#
# Usage:
#   MODE=full IMAGE_TAG=0.1.155-box.10 ./deploy/scripts/ci-deploy.sh
#   MODE=app  IMAGE_TAG=0.1.155-box.10 ./deploy/scripts/ci-deploy.sh
#   MODE=web  ./deploy/scripts/ci-deploy.sh
#
# Required env:
#   DEPLOY_HOST, DEPLOY_USER
# Optional:
#   DEPLOY_SSH_KEY_PATH, DEPLOY_APP_DIR (/opt/boxAI), DOCROOT (/var/www/you-box.com)
#   BOXAI_IMAGE_REPO, AGENT_IMAGE_REPO, PIN_AGENT (default 1)
#   SKIP_WEB_TESTS (default 0), VITE_AGENT_REMOTE_URL
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MODE="${MODE:-full}"
IMAGE_TAG="${IMAGE_TAG:-}"
DEPLOY_HOST="${DEPLOY_HOST:?DEPLOY_HOST is required}"
DEPLOY_USER="${DEPLOY_USER:?DEPLOY_USER is required}"
DEPLOY_APP_DIR="${DEPLOY_APP_DIR:-/opt/boxAI}"
DOCROOT="${DOCROOT:-/var/www/you-box.com}"
BOXAI_IMAGE_REPO="${BOXAI_IMAGE_REPO:-ghcr.io/fran0220/boxai}"
AGENT_IMAGE_REPO="${AGENT_IMAGE_REPO:-ghcr.io/fran0220/boxai-agent-gateway}"
PIN_AGENT="${PIN_AGENT:-1}"
SKIP_WEB_TESTS="${SKIP_WEB_TESTS:-0}"
VITE_AGENT_REMOTE_URL="${VITE_AGENT_REMOTE_URL:-https://api.you-box.com}"

export RSYNC_RSH="ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new"
SSH_BASE=(ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new)
if [[ -n "${DEPLOY_SSH_KEY_PATH:-}" ]]; then
  SSH_BASE+=(-i "$DEPLOY_SSH_KEY_PATH" -o IdentitiesOnly=yes)
  export RSYNC_RSH="ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new -i ${DEPLOY_SSH_KEY_PATH} -o IdentitiesOnly=yes"
fi

ssh_run() {
  "${SSH_BASE[@]}" "${DEPLOY_USER}@${DEPLOY_HOST}" "$@"
}

normalize_tag() {
  local t="$1"
  t="${t#v}"
  if [[ -z "$t" || "$t" == "latest" ]]; then
    echo "error: IMAGE_TAG must be a concrete pin (got '${1:-}')" >&2
    exit 1
  fi
  if [[ "$t" == *":"* ]]; then
    echo "error: IMAGE_TAG must not include registry path with digest form: $t" >&2
    exit 1
  fi
  printf '%s' "$t"
}

remote_pin_and_up() {
  local tag="$1"
  local app_image="${BOXAI_IMAGE_REPO}:${tag}"
  local agent_image="${AGENT_IMAGE_REPO}:${tag}"

  echo "==> Remote pin + compose up tag=${tag}"
  # Pass args as env to remote bash to avoid nested-quote bugs.
  ssh_run env \
    DEPLOY_APP_DIR="$DEPLOY_APP_DIR" \
    APP_IMAGE="$app_image" \
    AGENT_IMAGE="$agent_image" \
    PIN_AGENT="$PIN_AGENT" \
    bash -s <<'REMOTE'
set -euo pipefail
cd "${DEPLOY_APP_DIR}"
if [[ ! -f .env ]]; then
  echo "error: ${DEPLOY_APP_DIR}/.env missing" >&2
  exit 1
fi

COMPOSE_FILE=docker-compose.yml
if [[ ! -f "$COMPOSE_FILE" ]]; then
  if [[ -f docker-compose.local.yml ]]; then
    COMPOSE_FILE=docker-compose.local.yml
  else
    echo "error: no docker-compose.yml in ${DEPLOY_APP_DIR}" >&2
    exit 1
  fi
fi

pin_env() {
  local key="$1" val="$2"
  if grep -q "^${key}=" .env; then
    # portable in-place edit
    local tmp
    tmp="$(mktemp)"
    awk -v k="$key" -v v="$val" 'BEGIN{FS=OFS="="} $1==k {$0=k"="v} {print}' .env >"$tmp"
    cat "$tmp" >.env
    rm -f "$tmp"
  else
    printf '%s=%s\n' "$key" "$val" >> .env
  fi
}

pin_env BOXAI_IMAGE "$APP_IMAGE"
if [[ "$PIN_AGENT" == "1" ]]; then
  pin_env BOXAI_AGENT_GATEWAY_IMAGE "$AGENT_IMAGE"
fi

if grep -E '^(BOXAI_IMAGE|BOXAI_AGENT_GATEWAY_IMAGE)=.*:latest([[:space:]]|$)' .env; then
  echo "error: :latest pin refused" >&2
  exit 1
fi

echo "Pulling $APP_IMAGE ..."
docker pull "$APP_IMAGE"

SERVICES=(sub2api)
if [[ "$PIN_AGENT" == "1" ]]; then
  if docker pull "$AGENT_IMAGE"; then
    SERVICES+=(agent-gateway)
  else
    echo "warn: agent image $AGENT_IMAGE unavailable; app still updated"
  fi
fi

docker compose -f "$COMPOSE_FILE" up -d --no-deps "${SERVICES[@]}"

echo "Waiting for local health ..."
for i in $(seq 1 40); do
  if curl -fsS --max-time 3 http://127.0.0.1:8080/health >/dev/null 2>&1; then
    echo "OK sub2api /health"
    break
  fi
  if [[ "$i" -eq 40 ]]; then
    echo "error: sub2api /health not ready" >&2
    docker compose -f "$COMPOSE_FILE" ps || true
    exit 1
  fi
  sleep 3
done

if docker ps --format '{{.Names}}' | grep -qx boxai-agent-gateway; then
  if curl -fsS --max-time 5 http://127.0.0.1:8081/healthz >/dev/null 2>&1; then
    echo "OK agent-gateway /healthz"
  else
    echo "warn: agent-gateway /healthz not ready (non-fatal)"
  fi
fi

docker compose -f "$COMPOSE_FILE" ps
REMOTE
}

build_and_rsync_web() {
  echo "==> Build web/ and rsync to ${DEPLOY_USER}@${DEPLOY_HOST}:${DOCROOT}"
  cd "$ROOT/web"
  if [[ ! -d node_modules ]]; then
    pnpm install --frozen-lockfile
  fi
  if [[ "$SKIP_WEB_TESTS" != "1" ]]; then
    pnpm typecheck
    pnpm test:run
  fi
  VITE_AGENT_REMOTE_URL="$VITE_AGENT_REMOTE_URL" pnpm build
  if [[ ! -f dist/index.html ]]; then
    echo "error: web/dist/index.html missing after build" >&2
    exit 1
  fi

  ssh_run "mkdir -p '${DOCROOT}' && (chown -R \"\$(whoami):\$(whoami)\" '${DOCROOT}' 2>/dev/null || true)"
  rsync -az --delete \
    --exclude '.DS_Store' \
    "$ROOT/web/dist/" \
    "${DEPLOY_USER}@${DEPLOY_HOST}:${DOCROOT}/"
  ssh_run "test -f '${DOCROOT}/index.html' && ls -la '${DOCROOT}/index.html'"
  echo "OK static web deployed"
}

run_smoke() {
  echo "==> Smoke verify-topology"
  APEX="${APEX:-https://you-box.com}" \
  CONSOLE="${CONSOLE:-https://console.you-box.com}" \
  API="${API:-https://api.you-box.com}" \
    "$ROOT/deploy/scripts/verify-topology.sh"
}

case "$MODE" in
  app|web|full) ;;
  *)
    echo "error: MODE must be app|web|full (got $MODE)" >&2
    exit 1
    ;;
esac

echo "ci-deploy MODE=$MODE HOST=${DEPLOY_USER}@${DEPLOY_HOST}"

if [[ "$MODE" == "app" || "$MODE" == "full" ]]; then
  if [[ -z "$IMAGE_TAG" ]]; then
    echo "error: IMAGE_TAG required for MODE=$MODE" >&2
    exit 1
  fi
  IMAGE_TAG="$(normalize_tag "$IMAGE_TAG")"
  remote_pin_and_up "$IMAGE_TAG"
fi

if [[ "$MODE" == "web" || "$MODE" == "full" ]]; then
  build_and_rsync_web
fi

run_smoke
echo "OK ci-deploy finished MODE=$MODE"
