#!/usr/bin/env bash
# Copy gzip / keepalive / fetch-image cache snippets. Gọi trước nginx -t.
set -euo pipefail
APP_DIR="${APP_DIR:-/var/www/Thu-do-online}"
mkdir -p /etc/nginx/conf.d /etc/nginx/snippets /var/cache/nginx/nanoai-fetch-image
cp "${APP_DIR}/deploy/nginx-conf.d-nanoai.conf" /etc/nginx/conf.d/nanoai.conf
cp "${APP_DIR}/deploy/nginx-shop-locations.inc" /etc/nginx/snippets/nanoai-shop-locations.inc
if id www-data >/dev/null 2>&1; then
  chown -R www-data:www-data /var/cache/nginx/nanoai-fetch-image
fi
chmod 0755 /var/cache/nginx/nanoai-fetch-image
