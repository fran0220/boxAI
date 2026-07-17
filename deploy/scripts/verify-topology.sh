#!/usr/bin/env bash
# Real HTTP checks against dual-frontend topology.
# Usage: ./deploy/scripts/verify-topology.sh
#        BASE=https://you-box.com ./deploy/scripts/verify-topology.sh
set -euo pipefail

APEX="${APEX:-https://you-box.com}"
CONSOLE="${CONSOLE:-https://console.you-box.com}"
API="${API:-https://api.you-box.com}"
fail=0
body_file=$(mktemp)
headers_file=$(mktemp)
trap 'rm -f "$body_file" "$headers_file"' EXIT

check() {
  local name="$1" url="$2" expect="$3" method="${4:-GET}"
  local code body
  code=$(curl -sS -X "$method" -o "$body_file" -w '%{http_code}' --max-time 25 "$url" || echo "000")
  body=$(head -c 200 "$body_file" 2>/dev/null || true)
  if echo "$code" | grep -qE "$expect"; then
    echo "OK  [$code] $name  $url"
  else
    echo "FAIL [$code] $name  $url  body=${body}"
    fail=1
  fi
}

check_headers() {
  local name="$1" url="$2" required header missing=0
  required='strict-transport-security x-content-type-options x-frame-options referrer-policy permissions-policy content-security-policy'
  curl -sS -D "$headers_file" -o /dev/null --max-time 25 "$url" || true
  for header in $required; do
    if ! grep -qi "^${header}:" "$headers_file"; then
      echo "FAIL security header missing: $header ($name $url)"
      fail=1
      missing=1
    fi
  done
  if [[ "$missing" -eq 0 ]]; then echo "OK  security headers: $name"; fi
}

echo "=== Apex (React + proxy) ==="
check "apex home HTML" "$APEX/" "200"
check "apex health" "$APEX/health" "200"
check "apex public settings" "$APEX/api/v1/settings/public" "200"
check "apex session bootstrap unauth" "$APEX/api/v1/auth/session" "401|403" POST
check "apex session adopt unauth" "$APEX/api/v1/auth/session/adopt" "401|403" POST
check "apex session logout exists" "$APEX/api/v1/auth/session/logout" "200|204|400|401|403" POST
check "apex auth me unauth" "$APEX/api/v1/auth/me" "401|403"
check "apex SSO authorize unauth" "$APEX/api/v1/auth/boxai/sso/authorize" "401|403" POST
check "apex Creator ensure-key unauth" "$APEX/api/v1/boxai/creator/ensure-key" "401|403" POST
# BOXAI: customer shell — credential + account APIs reach backend (401/4xx), not edge 404.
check "apex credential login reaches backend" "$APEX/api/v1/auth/login" "400|401|403|422|429" POST
check "apex credential register reaches backend" "$APEX/api/v1/auth/register" "400|401|403|422|429" POST
check "apex registration prepare reaches backend" "$APEX/api/v1/auth/registration/prepare" "400|401|403|422|429" POST
check "apex registration complete reaches backend" "$APEX/api/v1/auth/registration/complete" "400|401|403|422|429" POST
check "apex keys unauth" "$APEX/api/v1/keys" "401|403"
check "apex usage unauth" "$APEX/api/v1/usage/dashboard/stats" "401|403"
check "apex payment plans unauth" "$APEX/api/v1/payment/plans" "401|403"
check "apex user profile unauth" "$APEX/api/v1/user/profile" "401|403"
check "apex admin blocked" "$APEX/api/v1/admin/settings" "404"
check "apex setup blocked" "$APEX/api/v1/setup/status" "404|401|403"
check "apex create SPA" "$APEX/create" "200"
check "apex login SPA" "$APEX/login" "200"
check "apex account SPA" "$APEX/account" "200"
check "apex checkout SPA" "$APEX/checkout" "200"
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
check "console registration prepare exists" "$CONSOLE/api/v1/auth/registration/prepare" "400|422|429" POST
check "console registration complete exists" "$CONSOLE/api/v1/auth/registration/complete" "400|422|429" POST

echo "=== API host (filtered) ==="
check "api health" "$API/health" "200"
check "api public settings" "$API/api/v1/settings/public" "200"
check "api models unauth" "$API/v1/models" "401|403"
check "api admin blocked" "$API/api/v1/admin/settings" "404|401|403"
check "api browser session blocked" "$API/api/v1/auth/session" "404" POST
check "api registration prepare blocked" "$API/api/v1/auth/registration/prepare" "404" POST
check "api registration complete blocked" "$API/api/v1/auth/registration/complete" "404" POST

echo "=== HTTPS security headers ==="
check_headers "apex" "$APEX/"
check_headers "console" "$CONSOLE/"
check_headers "api" "$API/health"

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
