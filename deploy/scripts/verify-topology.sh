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
  local name="$1" url="$2" required="${3:-strict-transport-security x-content-type-options x-frame-options referrer-policy permissions-policy content-security-policy}" header missing=0
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
check "apex SSO authorize removed" "$APEX/api/v1/auth/boxai/sso/authorize" "404" POST
check "apex SSO token removed" "$APEX/api/v1/auth/boxai/sso/token" "404" POST
check "apex Creator ensure-key unauth" "$APEX/api/v1/boxai/creator/ensure-key" "401|403" POST
# BOXAI: customer shell — credential + account APIs reach backend (401/4xx), not edge 404.
check "apex credential login reaches backend" "$APEX/api/v1/auth/login" "400|401|403|422|429" POST
check "apex credential register reaches backend" "$APEX/api/v1/auth/register" "400|401|403|422|429" POST
check "apex registration prepare reaches backend" "$APEX/api/v1/auth/registration/prepare" "400|401|403|422|429" POST
check "apex registration complete reaches backend" "$APEX/api/v1/auth/registration/complete" "400|401|403|422|429" POST
# BOXAI: OAuth start/exchange must reach backend on apex — not plain edge "Not Found".
# Disabled providers may return backend 404 JSON; edge deny is plain text "Not Found".
check_apex_api_not_edge_blocked() {
  local name="$1" url="$2" method="${3:-GET}"
  local code body
  if [[ "$method" == "POST" ]]; then
    code=$(curl -sS -X POST -o "$body_file" -w '%{http_code}' --max-time 25 \
      -H 'Content-Type: application/json' -H 'Accept: application/json' \
      -d '{}' "$url" || echo "000")
  else
    code=$(curl -sS -o "$body_file" -w '%{http_code}' --max-time 25 \
      -H 'Accept: application/json' "$url" || echo "000")
  fi
  body=$(head -c 240 "$body_file" 2>/dev/null || true)
  # Edge deny-by-default returns plain text "Not Found\n" (not Gin JSON).
  if [[ "$code" == "404" ]] && echo "$body" | grep -Eqx 'Not Found[[:space:]]*'; then
    echo "FAIL [$code] $name  $url  edge-blocked body=${body}"
    fail=1
    return
  fi
  # Backend-distinct: redirect, JSON 4xx/5xx, or JSON 404 (provider disabled).
  if echo "$code" | grep -qE '302|400|401|403|404|422|429|500|502|503'; then
    if [[ "$code" == "404" ]] && ! echo "$body" | grep -Eqi '[{"]|code|message|oauth|disabled'; then
      echo "FAIL [$code] $name  $url  non-JSON 404 body=${body}"
      fail=1
      return
    fi
    echo "OK  [$code] $name  $url"
  else
    echo "FAIL [$code] $name  $url  body=${body}"
    fail=1
  fi
}
check_apex_api_not_edge_blocked "apex oauth linuxdo start reaches backend" "$APEX/api/v1/auth/oauth/linuxdo/start"
check_apex_api_not_edge_blocked "apex oauth github start reaches backend" "$APEX/api/v1/auth/oauth/github/start"
check_apex_api_not_edge_blocked "apex oauth pending exchange reaches backend" "$APEX/api/v1/auth/oauth/pending/exchange" POST
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
check "api Agent Relay health" "$API/healthz" "200"
check "api Agent WebUI" "$API/" "200"
check "api Agent Relay status unauth" "$API/api/status" "401"

echo "=== HTTPS security headers ==="
check_headers "apex" "$APEX/"
check_headers "console" "$CONSOLE/"
check_headers "api" "$API/" 'strict-transport-security x-content-type-options referrer-policy permissions-policy content-security-policy'
if curl -sSI "$API/" | tr -d '\r' | grep -qi '^content-security-policy:.*frame-ancestors https://you-box.com'; then
  echo "OK  API WebUI frame-ancestors restricted to apex"
else
  echo "FAIL API WebUI frame-ancestors does not allow only apex"
  fail=1
fi

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
