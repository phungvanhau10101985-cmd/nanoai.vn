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
#   DEPLOY_SKIP_MIGRATIONS=1  Bỏ qua bước chạy migration SQL mới
#   DEPLOY_SETUP_CRONS=1  Tự đảm bảo cron AI/inventory/logo cleanup (mặc định bật)
#
# Script này sẽ:
# - pull code mới nhất từ origin/<branch>
# - chạy migration SQL trong db/migrations/ theo checksum:
#   + file mới: tự chạy
#   + file đã sửa nội dung: tự chạy lại
# - build + restart PM2
# - đảm bảo các cron chính cho messaging

APP_DIR="/var/www/Thu-do-online"
APP_NAME="thu-do-online"
BRANCH="${1:-main}"
DEPLOY_HEALTHCHECK_URL="${DEPLOY_HEALTHCHECK_URL:-http://127.0.0.1:3000/}"
DEPLOY_HEALTHCHECK_RETRIES="${DEPLOY_HEALTHCHECK_RETRIES:-15}"
DEPLOY_PM2_LOG_LINES="${DEPLOY_PM2_LOG_LINES:-100}"
LOG_DIR="${APP_DIR}/deploy/logs"
DEPLOY_SETUP_CRONS="${DEPLOY_SETUP_CRONS:-1}"
MIGRATION_STATE_FILE="${APP_DIR}/deploy/applied-migrations.sha256"

env_read_from_file() {
  local key="$1"
  local file="${APP_DIR}/.env.local"
  if [[ ! -f "${file}" ]]; then
    return 0
  fi
  sed -n "s/^${key}=//p" "${file}" | head -n1
}

env_read() {
  local key="$1"
  local v="${!key:-}"
  if [[ -n "${v}" ]]; then
    printf '%s' "${v}"
    return 0
  fi
  env_read_from_file "${key}"
}

ensure_cron() {
  local marker="$1"
  local line="$2"
  (crontab -l 2>/dev/null | grep -v "${marker}"; echo "${line}") | crontab -
}

migration_hash() {
  local f="$1"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "${f}" | awk '{print $1}'
    return 0
  fi
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "${f}" | awk '{print $1}'
    return 0
  fi
  echo "LỖI: không tìm thấy sha256sum/shasum để băm migration." >&2
  exit 1
}

echo "[1/11] Go to app directory: ${APP_DIR}"
cd "${APP_DIR}"

OLD_COMMIT=$(git rev-parse HEAD 2>/dev/null || true)

echo "[2/11] Fetch latest code from origin"
git fetch origin "${BRANCH}"

echo "[3/11] Checkout ${BRANCH} and reset to origin (bản mới nhất trên remote)"
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

echo "[4/11] Install dependencies"
npm install

echo "[5/11] Apply SQL migrations (new + modified)"
if [[ "${DEPLOY_SKIP_MIGRATIONS:-}" == "1" ]]; then
  echo "  Bỏ qua (DEPLOY_SKIP_MIGRATIONS=1)."
else
  mkdir -p "$(dirname "${MIGRATION_STATE_FILE}")"
  touch "${MIGRATION_STATE_FILE}"

  declare -A APPLIED_HASHES=()
  while IFS=$'\t' read -r path hash; do
    [[ -z "${path}" ]] && continue
    APPLIED_HASHES["${path}"]="${hash}"
  done < "${MIGRATION_STATE_FILE}"

  mapfile -t ALL_MIGRATIONS < <(git ls-files "db/migrations/*.sql" | sort)
  if [[ "${#ALL_MIGRATIONS[@]}" -eq 0 ]]; then
    echo "  Không tìm thấy migration trong db/migrations/."
  else
    has_state=0
    if [[ "${#APPLIED_HASHES[@]}" -gt 0 ]]; then
      has_state=1
    fi

    # Lần đầu bật cơ chế checksum: không replay toàn bộ lịch sử migration.
    # Nếu đang có deploy commit mới, chỉ chạy migration nằm trong diff OLD..NEW.
    # Sau đó ghi baseline hash cho toàn bộ file để các lần sau chỉ chạy NEW/CHANGED.
    if [[ "${has_state}" -eq 0 ]]; then
      echo "  Chưa có state checksum, bootstrap lần đầu..."
      if [[ -n "${OLD_COMMIT}" ]] && [[ "${OLD_COMMIT}" != "${NEW_HEAD}" ]]; then
        mapfile -t BOOTSTRAP_DIFF_MIGRATIONS < <(git diff --name-only "${OLD_COMMIT}" "${NEW_HEAD}" -- "db/migrations/*.sql" | sort)
        if [[ "${#BOOTSTRAP_DIFF_MIGRATIONS[@]}" -gt 0 ]]; then
          echo "  Chạy migration phát sinh trong đợt deploy này (${#BOOTSTRAP_DIFF_MIGRATIONS[@]} file):"
          for m in "${BOOTSTRAP_DIFF_MIGRATIONS[@]}"; do
            [[ -f "${m}" ]] || continue
            echo "  -> Apply BOOTSTRAP ${m}"
            node scripts/pg-run-sql-file.mjs "${m}" --apply
          done
        else
          echo "  Không có migration mới trong diff OLD..NEW, chỉ ghi baseline checksum."
        fi
      else
        echo "  Không có commit mới để tính diff, chỉ ghi baseline checksum."
      fi

      tmp_state="${MIGRATION_STATE_FILE}.tmp"
      : > "${tmp_state}"
      for m in "${ALL_MIGRATIONS[@]}"; do
        [[ -f "${m}" ]] || continue
        h="$(migration_hash "${m}")"
        printf '%s\t%s\n' "${m}" "${h}" >> "${tmp_state}"
      done
      mv "${tmp_state}" "${MIGRATION_STATE_FILE}"
      echo "  Bootstrap checksum hoàn tất: ${MIGRATION_STATE_FILE}"
      echo "  Từ lần deploy sau: NEW/CHANGED sẽ tự apply."
      # Bootstrap xong thì kết thúc bước migration tại đây.
      changed_count=0
      skipped_count="${#ALL_MIGRATIONS[@]}"
      echo "  Migration applied: ${changed_count}, unchanged skipped: ${skipped_count}"
      exit_bootstrap_done=1
    else
      exit_bootstrap_done=0
    fi

    if [[ "${exit_bootstrap_done}" -eq 1 ]]; then
      echo "  State file: ${MIGRATION_STATE_FILE}"
    else
    changed_count=0
    skipped_count=0
    echo "  Quét ${#ALL_MIGRATIONS[@]} file migration theo checksum..."
    for m in "${ALL_MIGRATIONS[@]}"; do
      if [[ ! -f "${m}" ]]; then
        continue
      fi
      curr_hash="$(migration_hash "${m}")"
      prev_hash="${APPLIED_HASHES[${m}]:-}"
      if [[ "${curr_hash}" != "${prev_hash}" ]]; then
        if [[ -z "${prev_hash}" ]]; then
          echo "  -> Apply NEW ${m}"
        else
          echo "  -> Apply CHANGED ${m}"
        fi
        node scripts/pg-run-sql-file.mjs "${m}" --apply
        APPLIED_HASHES["${m}"]="${curr_hash}"
        changed_count=$((changed_count + 1))
      else
        skipped_count=$((skipped_count + 1))
      fi
    done

    tmp_state="${MIGRATION_STATE_FILE}.tmp"
    : > "${tmp_state}"
    for m in "${ALL_MIGRATIONS[@]}"; do
      [[ -z "${APPLIED_HASHES[${m}]:-}" ]] && continue
      printf '%s\t%s\n' "${m}" "${APPLIED_HASHES[${m}]}" >> "${tmp_state}"
    done
    mv "${tmp_state}" "${MIGRATION_STATE_FILE}"
    echo "  Migration applied: ${changed_count}, unchanged skipped: ${skipped_count}"
    echo "  State file: ${MIGRATION_STATE_FILE}"
    fi
  fi
fi

echo "[6/11] Build app"
NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=4096}" npm run build

echo "[7/11] Restart PM2 (--update-env: nạp lại biến môi trường)"
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

echo "[8/11] Ensure messaging cron jobs"
if [[ "${DEPLOY_SETUP_CRONS}" == "1" ]]; then
  mkdir -p /root/logs
  AI_SECRET="$(env_read MESSAGING_PARTNER_AI_CRON_SECRET)"
  CRON_SECRET_FALLBACK="$(env_read CRON_SECRET)"
  INV_SECRET="$(env_read MESSAGING_INVENTORY_EMBED_CRON_SECRET)"
  LOGO_SECRET="$(env_read MESSAGING_LOGO_CLEANUP_CRON_SECRET)"

  if [[ -z "${AI_SECRET}" ]]; then AI_SECRET="${CRON_SECRET_FALLBACK}"; fi
  if [[ -z "${INV_SECRET}" ]]; then INV_SECRET="${AI_SECRET}"; fi
  if [[ -z "${LOGO_SECRET}" ]]; then LOGO_SECRET="${AI_SECRET}"; fi

  if [[ -n "${AI_SECRET}" ]]; then
    ensure_cron "messaging-partner-ai" "* * * * * curl -fsS -m 90 -X POST http://127.0.0.1:3000/api/cron/messaging-partner-ai -H \"Authorization: Bearer ${AI_SECRET}\" >> /root/logs/messaging-partner-ai.log 2>&1"
  else
    echo "  Cảnh báo: thiếu MESSAGING_PARTNER_AI_CRON_SECRET/CRON_SECRET, bỏ qua cron messaging-partner-ai."
  fi

  if [[ -n "${INV_SECRET}" ]]; then
    ensure_cron "messaging-inventory-embed-backfill" "*/5 * * * * curl -fsS -m 600 -X POST http://127.0.0.1:3000/api/cron/messaging-inventory-embed-backfill -H \"Authorization: Bearer ${INV_SECRET}\" >> /root/logs/inventory-embed-backfill.log 2>&1"
  else
    echo "  Cảnh báo: thiếu secret inventory cron, bỏ qua cron inventory-embed-backfill."
  fi

  if [[ -n "${LOGO_SECRET}" ]]; then
    ensure_cron "messaging-logo-cleanup" "30 3 * * * curl -fsS -m 120 -X POST http://127.0.0.1:3000/api/cron/messaging-logo-cleanup -H \"Authorization: Bearer ${LOGO_SECRET}\" >> /root/logs/messaging-logo-cleanup.log 2>&1"
  else
    echo "  Cảnh báo: thiếu secret logo cleanup cron, bỏ qua cron messaging-logo-cleanup."
  fi

  echo "  Cron hiện tại:"
  crontab -l | grep -E "messaging-partner-ai|messaging-inventory-embed-backfill|messaging-logo-cleanup" || true
else
  echo "  Bỏ qua (DEPLOY_SETUP_CRONS=${DEPLOY_SETUP_CRONS})."
fi

echo "[9/11] ${DEPLOY_PM2_LOG_LINES} dòng log PM2 cuối → file + màn hình"
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

echo "[10/11] PM2 status"
pm2 status

echo "[11/11] Health check (HTTP)"
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
