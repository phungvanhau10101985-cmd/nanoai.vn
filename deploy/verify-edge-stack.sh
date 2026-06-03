#!/usr/bin/env bash
# Kiểm tra Nginx + app + domain công khai (tránh web «sập» khi PM2 vẫn OK).
# Usage:
#   ./deploy/verify-edge-stack.sh
# Crontab (VPS, mỗi 5 phút):
#   */5 * * * * /var/www/Thu-do-online/deploy/verify-edge-stack.sh >> /root/logs/edge-stack-verify.log 2>&1
#
# Tùy chọn:
#   DEPLOY_PUBLIC_URL=https://nanoai.vn
#   APP_DIR=/var/www/Thu-do-online
#   VERIFY_EDGE_AUTOFIX_NGINX=1  — thử systemctl start nginx nếu đang tắt (chỉ khi nginx -t OK)

set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/Thu-do-online}"
PUBLIC_URL="${DEPLOY_PUBLIC_URL:-}"
AUTOFIX="${VERIFY_EDGE_AUTOFIX_NGINX:-1}"

if [[ -z "${PUBLIC_URL}" && -f "${APP_DIR}/.env.local" ]]; then
  PUBLIC_URL="$(sed -n 's/^NEXT_PUBLIC_BASE_URL=//p' "${APP_DIR}/.env.local" | head -n1 | tr -d "\"'" | tr -d '[:space:]')"
fi
PUBLIC_URL="${PUBLIC_URL:-https://nanoai.vn}"

errors=0
note() { echo "$*"; }
fail() { echo "LỖI: $*" >&2; errors=$((errors + 1)); }

note "=== verify-edge-stack $(date -Is) ==="

if [[ -d /etc/nginx/sites-enabled ]]; then
  mapfile -t junk < <(find /etc/nginx/sites-enabled -maxdepth 1 \( \
    -name '*.save' -o -name '*.bak' -o -name '*.tmp' -o -name '*~' \) 2>/dev/null || true)
  if [[ "${#junk[@]}" -gt 0 ]]; then
    for f in "${junk[@]}"; do
      fail "File backup trong sites-enabled (Nginx đọc cả thư mục): ${f} — mv ra sites-available/"
    done
  fi
fi

if ! sudo nginx -t >/dev/null 2>&1; then
  fail "nginx -t thất bại — chạy: sudo nginx -t"
  sudo nginx -t 2>&1 || true
else
  note "  OK: nginx -t"
fi

if ! systemctl is-active --quiet nginx; then
  if [[ "${AUTOFIX}" == "1" && "${errors}" -eq 0 ]]; then
    note "  Nginx đang tắt — thử start..."
    if sudo systemctl start nginx 2>/dev/null; then
      note "  OK: đã start nginx"
    else
      fail "Không start được nginx — xem: sudo systemctl status nginx"
    fi
  else
    fail "nginx.service không active"
  fi
else
  note "  OK: nginx active"
fi

if ! curl -fsS --max-time 15 -o /dev/null "http://127.0.0.1:3000/"; then
  fail "App không phản hồi http://127.0.0.1:3000/ — kiểm tra: pm2 status"
else
  note "  OK: http://127.0.0.1:3000/"
fi

if ! curl -fsS --max-time 15 -o /dev/null "http://127.0.0.1/"; then
  fail "Nginx không proxy http://127.0.0.1/ (cổng 80)"
else
  note "  OK: http://127.0.0.1/ (nginx → app)"
fi

public_base="${PUBLIC_URL%/}"
if ! curl -fsS --max-time 20 -o /dev/null "${public_base}/"; then
  fail "Domain công khai không phản hồi: ${public_base}/"
else
  note "  OK: ${public_base}/"
fi

if [[ "${errors}" -gt 0 ]]; then
  echo "FAIL: ${errors} lỗi stack edge" >&2
  exit 1
fi

note "PASS: nginx + app + domain"
