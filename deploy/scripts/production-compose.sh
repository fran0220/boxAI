#!/usr/bin/env bash
# Run Docker Compose against the currently active single-host release.
set -euo pipefail

DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/boxAI}"
export DEPLOY_ROOT
ACTIVE="${DEPLOY_ROOT}/current"
if [[ ! -f "${ACTIVE}/.boxai-commit" ]]; then
  echo "error: no active BoxAI commit at ${ACTIVE}" >&2
  exit 1
fi

export BOXAI_COMMIT
BOXAI_COMMIT="$(cat "${ACTIVE}/.boxai-commit")"
exec docker compose \
  -p boxai \
  --env-file "${DEPLOY_ROOT}/.env" \
  -f "${ACTIVE}/deploy/docker-compose.local.yml" \
  -f "${ACTIVE}/deploy/docker-compose.production.yml" \
  "$@"
