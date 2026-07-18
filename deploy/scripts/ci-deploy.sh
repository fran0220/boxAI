#!/usr/bin/env bash
# Deploy one immutable Git commit to the single BoxAI production host.
# Go API and Agent Relay images are built on that host; React is built by CI.
# Postgres, Redis, private R2 credentials, and user data remain in place.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DEPLOY_HOST="${DEPLOY_HOST:?DEPLOY_HOST is required}"
DEPLOY_USER="${DEPLOY_USER:?DEPLOY_USER is required}"
DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/boxAI}"
DOCROOT="${DOCROOT:-/var/www/you-box.com}"
COMMIT_SHA="${COMMIT_SHA:-$(git -C "$ROOT" rev-parse HEAD)}"

COMMIT_SHA="$(git -C "$ROOT" rev-parse "${COMMIT_SHA}^{commit}")"
RELEASE_DIR="${DEPLOY_ROOT}/releases/${COMMIT_SHA}"
WEB_RELEASE_DIR="${DEPLOY_ROOT}/web-releases/${COMMIT_SHA}"

SSH_BASE=(ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new)
RSYNC_SSH="ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new"
if [[ -n "${DEPLOY_SSH_KEY_PATH:-}" ]]; then
  SSH_BASE+=(-i "$DEPLOY_SSH_KEY_PATH" -o IdentitiesOnly=yes)
  RSYNC_SSH+=" -i ${DEPLOY_SSH_KEY_PATH} -o IdentitiesOnly=yes"
fi

ssh_run() {
  "${SSH_BASE[@]}" "${DEPLOY_USER}@${DEPLOY_HOST}" "$@"
}

if [[ ! -f "$ROOT/web/dist/index.html" ]]; then
  echo "error: web/dist/index.html missing; build the React app before deploy" >&2
  exit 1
fi

echo "==> Stage source commit ${COMMIT_SHA}"
stage_state="$(ssh_run env DEPLOY_ROOT="$DEPLOY_ROOT" COMMIT_SHA="$COMMIT_SHA" bash -s <<'REMOTE'
set -euo pipefail
release_dir="${DEPLOY_ROOT}/releases/${COMMIT_SHA}"
if [[ -f "${release_dir}/.boxai-commit" ]] && [[ "$(cat "${release_dir}/.boxai-commit")" == "$COMMIT_SHA" ]]; then
  echo existing
  exit 0
fi
tmp_dir="${DEPLOY_ROOT}/releases/.${COMMIT_SHA}.tmp"
rm -rf "$tmp_dir" "$release_dir"
mkdir -p "$tmp_dir"
echo upload
REMOTE
)"

if [[ "$stage_state" == *upload* ]]; then
  git -C "$ROOT" archive "$COMMIT_SHA" | \
    "${SSH_BASE[@]}" "${DEPLOY_USER}@${DEPLOY_HOST}" \
      "tar -x -C '${DEPLOY_ROOT}/releases/.${COMMIT_SHA}.tmp'"
  ssh_run env DEPLOY_ROOT="$DEPLOY_ROOT" COMMIT_SHA="$COMMIT_SHA" bash -s <<'REMOTE'
set -euo pipefail
tmp_dir="${DEPLOY_ROOT}/releases/.${COMMIT_SHA}.tmp"
release_dir="${DEPLOY_ROOT}/releases/${COMMIT_SHA}"
printf '%s\n' "$COMMIT_SHA" >"${tmp_dir}/.boxai-commit"
mv "$tmp_dir" "$release_dir"
REMOTE
fi

echo "==> Stage React build"
ssh_run "mkdir -p '${WEB_RELEASE_DIR}'"
rsync -az --delete -e "$RSYNC_SSH" \
  --exclude '.DS_Store' \
  "$ROOT/web/dist/" \
  "${DEPLOY_USER}@${DEPLOY_HOST}:${WEB_RELEASE_DIR}/"

echo "==> Build and activate ${COMMIT_SHA} on ${DEPLOY_USER}@${DEPLOY_HOST}"
ssh_run env \
  DEPLOY_ROOT="$DEPLOY_ROOT" \
  RELEASE_DIR="$RELEASE_DIR" \
  WEB_RELEASE_DIR="$WEB_RELEASE_DIR" \
  DOCROOT="$DOCROOT" \
  BOXAI_COMMIT="$COMMIT_SHA" \
  bash -s <<'REMOTE'
set -euo pipefail

env_file="${DEPLOY_ROOT}/.env"
base_compose="${RELEASE_DIR}/deploy/docker-compose.local.yml"
prod_compose="${RELEASE_DIR}/deploy/docker-compose.production.yml"
active_link="${DEPLOY_ROOT}/current"
nginx_site="/etc/nginx/sites-available/you-box.com"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_dir="${DEPLOY_ROOT}/backups/deploy-${timestamp}-${BOXAI_COMMIT}"
sudo_cmd=()
if [[ "$(id -u)" -ne 0 ]]; then
  sudo_cmd=(sudo)
fi

if [[ ! -f "$env_file" ]]; then
  echo "error: ${env_file} is missing" >&2
  exit 1
fi

require_data_container() {
  local container="$1" destination="$2" expected_source="$3"
  local project source
  project="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$container" 2>/dev/null || true)"
  source="$(docker inspect --format "{{range .Mounts}}{{if eq .Destination \"${destination}\"}}{{.Source}}{{end}}{{end}}" "$container" 2>/dev/null || true)"
  if [[ "$project" != "boxai" || "$source" != "$expected_source" ]]; then
    echo "error: ${container} is not the expected BoxAI data container" >&2
    echo "       compose project=${project:-absent}, data source=${source:-absent}" >&2
    echo "       expected project=boxai, data source=${expected_source}" >&2
    echo "       complete the one-time host adoption in docs/PRODUCTION.md before deploying" >&2
    exit 1
  fi
}

# A routine deploy never creates or adopts data services implicitly. This also
# prevents a project-name/path mismatch from booting against an empty database.
require_data_container sub2api-postgres /var/lib/postgresql/data "${DEPLOY_ROOT}/postgres_data"
require_data_container sub2api-redis /data "${DEPLOY_ROOT}/redis_data"

compose=(docker compose -p boxai --env-file "$env_file" -f "$base_compose" -f "$prod_compose")
export BOXAI_COMMIT DEPLOY_ROOT

echo "Validating compose and building local images ..."
"${compose[@]}" config --quiet
"${compose[@]}" build sub2api agent-gateway

mkdir -p "$backup_dir"
chmod 700 "$backup_dir"
cp "$env_file" "$backup_dir/.env"
chmod 600 "$backup_dir/.env"
if [[ -e "$active_link" ]]; then
  readlink -f "$active_link" >"$backup_dir/previous-release"
elif [[ -f "${DEPLOY_ROOT}/docker-compose.yml" ]]; then
  cp "${DEPLOY_ROOT}/docker-compose.yml" "$backup_dir/docker-compose.yml"
fi
if [[ -f "$nginx_site" ]]; then
  "${sudo_cmd[@]}" cp "$nginx_site" "$backup_dir/nginx-you-box.com.conf"
fi
if [[ -d "$DOCROOT" ]]; then
  "${sudo_cmd[@]}" tar -C "$DOCROOT" -czf "$backup_dir/web.tar.gz" .
fi
if docker inspect sub2api-postgres >/dev/null 2>&1; then
  docker exec sub2api-postgres sh -c \
    'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
    >"$backup_dir/postgres.dump"
fi

mutated=0
rollback() {
  rc=$?
  trap - ERR EXIT
  if [[ "$mutated" == "1" ]]; then
    echo "Deploy failed; restoring the previous release ..." >&2
    if [[ -f "$backup_dir/nginx-you-box.com.conf" ]]; then
      "${sudo_cmd[@]}" cp "$backup_dir/nginx-you-box.com.conf" "$nginx_site" || true
      "${sudo_cmd[@]}" nginx -t >/dev/null 2>&1 && "${sudo_cmd[@]}" systemctl reload nginx || true
    fi
    if [[ -f "$backup_dir/web.tar.gz" ]]; then
      "${sudo_cmd[@]}" mkdir -p "$DOCROOT"
      "${sudo_cmd[@]}" find "$DOCROOT" -mindepth 1 -maxdepth 1 -exec rm -rf -- {} + || true
      "${sudo_cmd[@]}" tar -C "$DOCROOT" -xzf "$backup_dir/web.tar.gz" || true
    fi

    previous=""
    previous_commit=""
    if [[ -f "$backup_dir/previous-release" ]]; then
      previous="$(cat "$backup_dir/previous-release" 2>/dev/null || true)"
      previous_commit="$(cat "$previous/.boxai-commit" 2>/dev/null || true)"
    fi
    if [[ -n "$previous" && -n "$previous_commit" && -f "$previous/deploy/docker-compose.production.yml" ]]; then
      BOXAI_COMMIT="$previous_commit" docker compose \
        -p boxai --env-file "$env_file" \
        -f "$previous/deploy/docker-compose.local.yml" \
        -f "$previous/deploy/docker-compose.production.yml" \
        up -d --no-deps sub2api agent-gateway || true
    elif [[ -f "$backup_dir/docker-compose.yml" ]]; then
      docker rm -f boxai-agent-gateway >/dev/null 2>&1 || true
      docker compose -p boxai --project-directory "$DEPLOY_ROOT" --env-file "$env_file" \
        -f "$backup_dir/docker-compose.yml" up -d --no-deps sub2api || true
    fi
  fi
  exit "$rc"
}
trap rollback ERR EXIT

mutated=1
"${compose[@]}" up -d --no-deps sub2api agent-gateway

for attempt in $(seq 1 60); do
  if curl -fsS --max-time 3 http://127.0.0.1:8080/health >/dev/null; then
    break
  fi
  if [[ "$attempt" -eq 60 ]]; then
    echo "error: sub2api did not become healthy" >&2
    exit 1
  fi
  sleep 3
done

for attempt in $(seq 1 40); do
  if curl -fsS --max-time 3 http://127.0.0.1:8081/healthz >/dev/null; then
    break
  fi
  if [[ "$attempt" -eq 40 ]]; then
    echo "error: Agent Relay did not become healthy" >&2
    exit 1
  fi
  sleep 3
done

"${sudo_cmd[@]}" mkdir -p "$DOCROOT"
"${sudo_cmd[@]}" rsync -a --delete "${WEB_RELEASE_DIR}/" "${DOCROOT}/"
"${sudo_cmd[@]}" install -m 0644 \
  "${RELEASE_DIR}/deploy/nginx-you-box.com.conf" "$nginx_site"
"${sudo_cmd[@]}" nginx -t
"${sudo_cmd[@]}" systemctl reload nginx

rm -f "${active_link}.new"
ln -s "$RELEASE_DIR" "${active_link}.new"
mv -Tf "${active_link}.new" "$active_link"
mutated=0
trap - ERR EXIT

"${compose[@]}" ps
echo "OK deployed commit ${BOXAI_COMMIT}"
echo "Backup: ${backup_dir}"
REMOTE

echo "==> Verify public topology"
"$ROOT/deploy/scripts/verify-topology.sh"
echo "OK production deploy ${COMMIT_SHA}"
