#!/usr/bin/env bash
# Real HTTP checks against dual-frontend topology.
# Usage: ./deploy/scripts/verify-topology.sh
#        BASE=https://you-box.com ./deploy/scripts/verify-topology.sh
set -euo pipefail

APEX="${APEX:-https://you-box.com}"
CONSOLE="${CONSOLE:-https://console.you-box.com}"
API="${API:-https://api.you-box.com}"
fail=0

check() {
  local name="$1" url="$2" expect="$3"
  local code body
  code=$(curl -sS -o /tmp/boxai-verify-body -w '%{http_code}' --max-time 25 "$url" || echo "000")
  body=$(head -c 200 /tmp/boxai-verify-body 2>/dev/null || true)
  if echo "$code" | grep -qE "$expect"; then
    echo "OK  [$code] $name  $url"
  else
    echo "FAIL [$code] $name  $url  body=${body}"
    fail=1
  fi
}

echo "=== Apex (React + proxy) ==="
check "apex home HTML" "$APEX/" "200"
check "apex health" "$APEX/health" "200"
check "apex public settings" "$APEX/api/v1/settings/public" "200"
check "apex create SPA" "$APEX/create" "200"
check "apex login SPA" "$APEX/login" "200"
# React index should not be Vue title-only; look for root div
if curl -sS "$APEX/" | grep -q 'id="root"\|id='\''root'\'''; then
  echo "OK  React root mount present on apex"
else
  echo "WARN apex HTML may not be React (no id=root); check cutover"
fi

echo "=== Console (Vue) ==="
check "console home" "$CONSOLE/" "200"
check "console health via proxy" "$CONSOLE/health" "200"
check "console public settings" "$CONSOLE/api/v1/settings/public" "200"
check "console SSO start route exists" "$CONSOLE/boxai/sso/start" "200|302|401"

echo "=== API host (filtered) ==="
check "api health" "$API/health" "200"
check "api public settings" "$API/api/v1/settings/public" "200"
check "api models unauth" "$API/v1/models" "401|403"
check "api admin blocked" "$API/api/v1/admin/settings" "404|401|403"

echo "=== www redirect ==="
loc=$(curl -sSI "https://www.you-box.com/" | tr -d '\r' | awk 'tolower($1)=="location:"{print $2; exit}')
if echo "$loc" | grep -qi 'you-box.com'; then
  echo "OK  www redirects to $loc"
else
  echo "WARN www Location=$loc"
fi

if [[ "$fail" -ne 0 ]]; then
  echo "VERIFY FAILED"
  exit 1
fi
echo "VERIFY PASSED"
