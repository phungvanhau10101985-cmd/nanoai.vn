#!/usr/bin/env bash
# Cấp SSL + nginx cho một hostname shop (Let's Encrypt HTTP-01).
# Usage (trên VPS, cần root):
#   sudo bash deploy/provision-partner-domain-ssl.sh www.tiemanhai.vn
#
# Biến tuỳ chọn:
#   CERTBOT_EMAIL=admin@nanoai.vn
#   NGINX_SITES_AVAILABLE=/etc/nginx/sites-available
#   NGINX_SITES_ENABLED=/etc/nginx/sites-enabled
#   CERTBOT_WEBROOT=/var/www/certbot

set -euo pipefail

HOST="${1:-}"
if [[ -z "${HOST}" ]]; then
  echo "Usage: sudo bash deploy/provision-partner-domain-ssl.sh <hostname>" >&2
  exit 1
fi

HOST="$(echo "${HOST}" | tr '[:upper:]' '[:lower:]' | sed 's/\.$//')"
if [[ ! "${HOST}" =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$ ]]; then
  echo "Hostname không hợp lệ: ${HOST}" >&2
  exit 1
fi

if [[ "${EUID}" -ne 0 ]]; then
  echo "Chạy với sudo." >&2
  exit 1
fi

APP_DIR="${APP_DIR:-/var/www/Thu-do-online}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-admin@nanoai.vn}"
NGINX_SITES_AVAILABLE="${NGINX_SITES_AVAILABLE:-/etc/nginx/sites-available}"
NGINX_SITES_ENABLED="${NGINX_SITES_ENABLED:-/etc/nginx/sites-enabled}"
CERTBOT_WEBROOT="${CERTBOT_WEBROOT:-/var/www/certbot}"
SAFE_NAME="$(echo "${HOST}" | tr '.' '-')"
SITE_FILE="${NGINX_SITES_AVAILABLE}/partner-${SAFE_NAME}.conf"
TEMPLATE="${APP_DIR}/deploy/nginx-partner-domain.conf.template"

mkdir -p "${CERTBOT_WEBROOT}"
mkdir -p "${NGINX_SITES_AVAILABLE}" "${NGINX_SITES_ENABLED}"

if [[ -f "/etc/letsencrypt/live/${HOST}/fullchain.pem" ]]; then
  echo "Cert đã tồn tại: ${HOST}"
else
  # HTTP-only block để certbot HTTP-01 (trước khi có HTTPS)
  HTTP_ONLY="${NGINX_SITES_AVAILABLE}/partner-${SAFE_NAME}-http.conf"
  cat > "${HTTP_ONLY}" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${HOST};

    location /.well-known/acme-challenge/ {
        root ${CERTBOT_WEBROOT};
        try_files \\\$uri =404;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host \\\$host;
        proxy_set_header X-Real-IP \\\$remote_addr;
        proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\\$scheme;
    }
}
EOF
  ln -sf "${HTTP_ONLY}" "${NGINX_SITES_ENABLED}/partner-${SAFE_NAME}-http.conf"
  nginx -t
  systemctl reload nginx

  certbot certonly --webroot -w "${CERTBOT_WEBROOT}" \
    -d "${HOST}" \
    --non-interactive --agree-tos -m "${CERTBOT_EMAIL}" \
    --keep-until-expiring || {
      echo "certbot thất bại cho ${HOST}" >&2
      exit 1
    }

  rm -f "${NGINX_SITES_ENABLED}/partner-${SAFE_NAME}-http.conf"
fi

if [[ ! -f "${TEMPLATE}" ]]; then
  echo "Thiếu template: ${TEMPLATE}" >&2
  exit 1
fi

sed "s/__HOSTNAME__/${HOST}/g" "${TEMPLATE}" > "${SITE_FILE}"
ln -sf "${SITE_FILE}" "${NGINX_SITES_ENABLED}/partner-${SAFE_NAME}.conf"

nginx -t
systemctl reload nginx

echo "OK: ${HOST} — nginx + SSL sẵn sàng"
