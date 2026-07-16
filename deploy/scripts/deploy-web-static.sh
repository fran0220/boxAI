#!/usr/bin/env bash
# Build React web/ and rsync dist to production docroot on youbox.
# Usage:
#   ./deploy/scripts/deploy-web-static.sh              # build + deploy to youbox
#   ./deploy/scripts/deploy-web-static.sh --build-only
#   SSH_HOST=youbox DOCROOT=/var/www/you-box.com ./deploy/scripts/deploy-web-static.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SSH_HOST="${SSH_HOST:-youbox}"
DOCROOT="${DOCROOT:-/var/www/you-box.com}"
BUILD_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --build-only) BUILD_ONLY=1 ;;
  esac
done

cd "$ROOT/web"
if [[ ! -d node_modules ]]; then
  pnpm install --frozen-lockfile
fi
pnpm typecheck
pnpm test:run
pnpm build

if [[ ! -f dist/index.html ]]; then
  echo "error: web/dist/index.html missing after build" >&2
  exit 1
fi

echo "Built web/dist ($(du -sh dist | awk '{print $1}'))"

if [[ "$BUILD_ONLY" -eq 1 ]]; then
  exit 0
fi

echo "Deploying to ${SSH_HOST}:${DOCROOT} ..."
ssh -o BatchMode=yes "$SSH_HOST" "sudo mkdir -p '${DOCROOT}' && sudo chown -R \"\$(whoami):\$(whoami)\" '${DOCROOT}' || true"
rsync -az --delete \
  --exclude '.DS_Store' \
  "$ROOT/web/dist/" \
  "${SSH_HOST}:${DOCROOT}/"

echo "Remote index:"
ssh -o BatchMode=yes "$SSH_HOST" "ls -la '${DOCROOT}/index.html' && head -c 120 '${DOCROOT}/index.html'; echo"
echo "OK: static web deployed"
