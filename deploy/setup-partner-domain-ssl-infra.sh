#!/usr/bin/env bash
# Thiết lập hạ tầng SSL tên miền shop — chạy MỘT LẦN trên VPS (root).
# Usage: sudo bash deploy/setup-partner-domain-ssl-infra.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/Thu-do-online}"
CERTBOT_WEBROOT="${CERTBOT_WEBROOT:-/var/www/certbot}"

echo "[1/4] Webroot Let's Encrypt"
mkdir -p "${CERTBOT_WEBROOT}"

echo "[2/4] Nginx catch-all (domain shop → app NanoAI, không redirect 188)"
cp "${APP_DIR}/deploy/nginx-partner-catchall.conf" /etc/nginx/sites-available/nanoai-partner-catchall
ln -sf /etc/nginx/sites-available/nanoai-partner-catchall /etc/nginx/sites-enabled/nanoai-partner-catchall

echo "[3/4] Kiểm tra nginx"
nginx -t
systemctl reload nginx

echo "[4/4] Certbot (nếu chưa cài)"
if ! command -v certbot >/dev/null 2>&1; then
  apt-get update
  apt-get install -y certbot python3-certbot-nginx
fi

chmod +x "${APP_DIR}/deploy/provision-partner-domain-ssl.sh"

echo ""
echo "Hoàn tất. Thêm vào .env.local trên VPS:"
echo "  PARTNER_DOMAIN_SSL_AUTO_PROVISION=1"
echo "  PARTNER_DOMAIN_SSL_USE_SUDO=1"
echo "  PARTNER_DOMAIN_SSL_CRON_SECRET=<openssl rand -hex 32>"
echo ""
echo "QUAN TRỌNG: kiểm tra config 188.com.vn — KHÔNG redirect default_server mọi Host → 188."
echo "Sau đó: pm2 restart thu-do-online --update-env && bash deploy/update-vps.sh main"
