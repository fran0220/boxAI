#!/usr/bin/env bash
# Install dual-frontend nginx config on youbox and expand TLS certs.
# Run from repo root or any cwd; uses SSH_HOST=youbox by default.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SSH_HOST="${SSH_HOST:-youbox}"
CONF_SRC="$ROOT/deploy/nginx-you-box.com.conf"
REMOTE_AVAIL=/etc/nginx/sites-available/you-box.com
REMOTE_ENABLED=/etc/nginx/sites-enabled/you-box.com

if [[ ! -f "$CONF_SRC" ]]; then
  echo "missing $CONF_SRC" >&2
  exit 1
fi

echo "Uploading nginx config..."
scp -o BatchMode=yes "$CONF_SRC" "${SSH_HOST}:/tmp/you-box.com.nginx"
ssh -o BatchMode=yes "$SSH_HOST" bash -s <<'REMOTE'
set -euo pipefail
sudo cp /tmp/you-box.com.nginx /etc/nginx/sites-available/you-box.com
sudo ln -sfn /etc/nginx/sites-available/you-box.com /etc/nginx/sites-enabled/you-box.com
# Remove default if it conflicts
sudo rm -f /etc/nginx/sites-enabled/default

# Expand certbot to cover console + api (reuses existing cert name you-box.com)
if command -v certbot >/dev/null 2>&1; then
  sudo certbot certonly --nginx --non-interactive --agree-tos \
    --cert-name you-box.com \
    -d you-box.com -d www.you-box.com -d console.you-box.com -d api.you-box.com \
    --expand || {
      echo "WARN: certbot expand failed; trying renew with nginx plugin..."
      sudo certbot --nginx --non-interactive --expand \
        -d you-box.com -d www.you-box.com -d console.you-box.com -d api.you-box.com || true
    }
fi

sudo nginx -t
sudo systemctl reload nginx
echo "nginx reloaded"
REMOTE

echo "OK: nginx topology applied on ${SSH_HOST}"
