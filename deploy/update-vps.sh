#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./deploy/update-vps.sh                # branch = main
#   ./deploy/update-vps.sh production     # custom branch
#
# Tùy chọn môi trường:
#   DEPLOY_HEALTHCHECK_URL   URL kiểm tra sau khi PM2 chạy (mặc định http://127.0.0.1:3000/)
#   DEPLOY_SKIP_HEALTHCHECK=1  Bỏ qua bước curl
#   DEPLOY_HEALTHCHECK_RETRIES=15  Số lần thử (mỗi lần cách 2s) chờ app lên
#   DEPLOY_PM2_LOG_LINES=100  Số dòng log PM2 ghi ra file + màn hình (mặc định 100)
#   DEPLOY_REBOOT_VPS=1  Sau khi deploy OK: reboot cả VPS (SSH sẽ ngắt; cần pm2 startup)
#
# Lưu ý (không tự chạy trong script này):
# - Migration Supabase: messaging_partner_ai_* (xem supabase/migrations/)
# - Partner AI cron: MESSAGING_PARTNER_AI_CRON_SECRET + crontab gọi GET/POST /api/cron/messaging-partner-ai

APP_DIR="/var/www/Thu-do-online"
APP_NAME="thu-do-online"
BRANCH="${1:-main}"
DEPLOY_HEALTHCHECK_URL="${DEPLOY_HEALTHCHECK_URL:-http://127.0.0.1:3000/}"
DEPLOY_HEALTHCHECK_RETRIES="${DEPLOY_HEALTHCHECK_RETRIES:-15}"
DEPLOY_PM2_LOG_LINES="${DEPLOY_PM2_LOG_LINES:-100}"
LOG_DIR="${APP_DIR}/deploy/logs"

echo "[1/9] Go to app directory: ${APP_DIR}"
cd "${APP_DIR}"

OLD_COMMIT=$(git rev-parse HEAD 2>/dev/null || true)

echo "[2/9] Fetch latest code from origin"
git fetch origin "${BRANCH}"

echo "[3/9] Checkout ${BRANCH} and reset to origin (bản mới nhất trên remote)"
git checkout "${BRANCH}"
git reset --hard "origin/${BRANCH}"

NEW_HEAD="$(git rev-parse HEAD)"
ORIGIN_HEAD="$(git rev-parse "origin/${BRANCH}")"
if [[ "${NEW_HEAD}" != "${ORIGIN_HEAD}" ]]; then
  echo "LỖI: HEAD (${NEW_HEAD}) không khớp origin/${BRANCH} (${ORIGIN_HEAD})." >&2
  exit 1
fi

echo ""
echo "--- Xác nhận: đang đúng commit mới nhất trên origin/${BRANCH} ---"
echo "  Remote: $(git remote get-url origin 2>/dev/null || echo '(unknown)')"
echo "  Commit: ${NEW_HEAD}"
git log -1 --format='  %h %s (%ci)'
echo "----------------------------------------------------------------"
echo ""

if [[ -n "${OLD_COMMIT}" ]] && [[ "${OLD_COMMIT}" != "${NEW_HEAD}" ]]; then
  echo "--- Thay đổi code (so với trước khi deploy) ---"
  git diff --shortstat "${OLD_COMMIT}" HEAD || true
  echo "------------------------------------------------"
  echo ""
fi

echo "[4/9] Install dependencies"
npm install

echo "[5/9] Build app"
NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=4096}" npm run build

echo "[6/9] Restart PM2 (--update-env: nạp lại biến môi trường)"
if pm2 describe "${APP_NAME}" >/dev/null 2>&1; then
  pm2 restart "${APP_NAME}" --update-env
else
  pm2 start npm --name "${APP_NAME}" -- start
fi
if pm2 describe "worksheet-worker" >/dev/null 2>&1; then
  pm2 restart worksheet-worker --update-env
else
  pm2 start "npm run worker" --name worksheet-worker
fi
pm2 save

echo "[7/9] ${DEPLOY_PM2_LOG_LINES} dòng log PM2 cuối → file + màn hình"
mkdir -p "${LOG_DIR}"
PM2_LOG_SNAPSHOT="${LOG_DIR}/pm2-snapshot-${APP_NAME}-$(date +%Y%m%d-%H%M%S).log"
{
  echo "========== $(date -Is) | commit ${NEW_HEAD} | ${APP_NAME} =========="
  pm2 logs "${APP_NAME}" --lines "${DEPLOY_PM2_LOG_LINES}" --nostream 2>&1 || true
  echo ""
  echo "========== worksheet-worker (same snapshot) =========="
  pm2 logs worksheet-worker --lines "${DEPLOY_PM2_LOG_LINES}" --nostream 2>&1 || true
} | tee "${PM2_LOG_SNAPSHOT}"
echo ""
echo "  Đã lưu: ${PM2_LOG_SNAPSHOT}"

echo "[8/9] PM2 status"
pm2 status

echo "[9/9] Health check (HTTP)"
if [[ "${DEPLOY_SKIP_HEALTHCHECK:-}" == "1" ]]; then
  echo "  Bỏ qua (DEPLOY_SKIP_HEALTHCHECK=1)."
else
  ok=0
  for ((i = 1; i <= DEPLOY_HEALTHCHECK_RETRIES; i++)); do
    if curl -fsS --max-time 15 -o /dev/null "${DEPLOY_HEALTHCHECK_URL}"; then
      ok=1
      echo "  OK: ${DEPLOY_HEALTHCHECK_URL} (lần thử ${i}/${DEPLOY_HEALTHCHECK_RETRIES})"
      break
    fi
    echo "  Chờ app lên... (${i}/${DEPLOY_HEALTHCHECK_RETRIES})"
    sleep 2
  done
  if [[ "${ok}" -ne 1 ]]; then
    echo "LỖI: Health check thất bại sau ${DEPLOY_HEALTHCHECK_RETRIES} lần: ${DEPLOY_HEALTHCHECK_URL}" >&2
    echo "  Gợi ý: đổi port bằng DEPLOY_HEALTHCHECK_URL, hoặc DEPLOY_SKIP_HEALTHCHECK=1 nếu app không bind localhost." >&2
    exit 1
  fi
fi

echo ""
echo "Hoàn tất. PM2 đang chạy bản build từ commit ${NEW_HEAD} (trùng origin/${BRANCH})."

if [[ "${DEPLOY_REBOOT_VPS:-}" == "1" ]]; then
  echo ""
  echo "DEPLOY_REBOOT_VPS=1 — khởi động lại máy VPS sau 10 giây (SSH sẽ ngắt)..."
  sleep 10
  sudo reboot
fi
