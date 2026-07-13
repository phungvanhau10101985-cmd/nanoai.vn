#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./deploy/update-vps.sh                # branch = main
#   ./deploy/update-vps.sh production     # custom branch
#
# Tùy chọn môi trường:
#   DEPLOY_HEALTHCHECK_URL   URL kiểm tra sau khi PM2 chạy (mặc định http://127.0.0.1:3000/)
#   DEPLOY_SKIP_HEALTHCHECK=1  Bỏ qua bước curl app
#   DEPLOY_SKIP_EDGE_CHECK=1  Bỏ qua kiểm tra nginx + domain (deploy/verify-edge-stack.sh)
#   DEPLOY_PUBLIC_URL        Domain production (mặc định đọc NEXT_PUBLIC_BASE_URL từ .env.local)
#   DEPLOY_HEALTHCHECK_RETRIES=15  Số lần thử (mỗi lần cách 2s) chờ app lên
#   DEPLOY_PM2_LOG_LINES=100  Số dòng log PM2 ghi ra file + màn hình (mặc định 100)
#   DEPLOY_REBOOT_VPS=1  Sau khi deploy OK: reboot cả VPS (SSH sẽ ngắt; cần pm2 startup)
#   DEPLOY_BUILD_VPS=1  Build kiểu «rất yếu»: npm run build:vps (bỏ cả kiểm tra TypeScript khi build — chỉ khi máy vẫn OOM; nên chạy build:full trên máy khác/CI)
#   DEPLOY_SKIP_LINT=1  Bỏ qua npm run lint (không khuyến nghị cho production)
#   DEPLOY_SKIP_TYPECHECK=1  Bỏ qua npx tsc --noEmit (không khuyến nghị cho production)
#   DEPLOY_STOP_PM2_BEFORE_BUILD=1  Dừng toàn bộ process PM2 trước khi lint/typecheck/build để giải phóng RAM (mặc định bật)
#   DEPLOY_SKIP_MIGRATIONS=1  Bỏ qua bước chạy migration SQL mới
#   DEPLOY_SETUP_CRONS=1  Tự đảm bảo cron AI/inventory/logo cleanup + nhắc lịch đám cưới (mặc định bật)
#
# Script này sẽ:
# - pull code mới nhất từ origin/<branch>
# - chạy migration SQL trong db/migrations/ theo checksum:
#   + file mới: tự chạy
#   + file đã sửa nội dung: tự chạy lại
# - build + restart PM2
# - đảm bảo các cron chính (messaging + nhắc lịch đám cưới)

APP_DIR="/var/www/Thu-do-online"
APP_NAME="thu-do-online"
BRANCH="${1:-main}"
DEPLOY_HEALTHCHECK_URL="${DEPLOY_HEALTHCHECK_URL:-http://127.0.0.1:3000/}"
DEPLOY_HEALTHCHECK_RETRIES="${DEPLOY_HEALTHCHECK_RETRIES:-15}"
DEPLOY_PM2_LOG_LINES="${DEPLOY_PM2_LOG_LINES:-100}"
DEPLOY_STOP_PM2_BEFORE_BUILD="${DEPLOY_STOP_PM2_BEFORE_BUILD:-1}"
LOG_DIR="${APP_DIR}/deploy/logs"
DEPLOY_SETUP_CRONS="${DEPLOY_SETUP_CRONS:-1}"
MIGRATION_STATE_FILE="${APP_DIR}/deploy/applied-migrations.sha256"

env_read_from_file() {
  local key="$1"
  local file="${APP_DIR}/.env.local"
  if [[ ! -f "${file}" ]]; then
    return 0
  fi
  sed -n "s/^${key}=//p" "${file}" | head -n1 | tr -d '\r\n'
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

echo "[1/15] Go to app directory: ${APP_DIR}"
cd "${APP_DIR}"
echo "  DONE [1/15]"

OLD_COMMIT=$(git rev-parse HEAD 2>/dev/null || true)

echo "[2/15] Fetch latest code from origin"
git fetch --prune origin "${BRANCH}"
echo "  DONE [2/15]"

echo "[3/15] Checkout ${BRANCH} and reset to origin (bản mới nhất trên remote)"
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
echo "  DONE [3/15]"

if [[ -n "${OLD_COMMIT}" ]] && [[ "${OLD_COMMIT}" != "${NEW_HEAD}" ]]; then
  echo "--- Thay đổi code (so với trước khi deploy) ---"
  git diff --shortstat "${OLD_COMMIT}" HEAD || true
  echo "------------------------------------------------"
  echo ""
fi

echo "[4/15] Install dependencies (lockfile-first)"
if [[ -f "package-lock.json" ]]; then
  npm ci
else
  npm install
fi
echo "  DONE [4/15]"

echo "[5/15] Apply SQL migrations (new + modified)"
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
echo "  DONE [5/15]"

echo "[6/15] Free RAM before build (stop all PM2 processes)"
if [[ "${DEPLOY_STOP_PM2_BEFORE_BUILD}" == "1" ]]; then
  # Lưu process list hiện tại để có thể resurrect sau build.
  pm2 save || true
  pm2 stop all || true
  echo "  Đã dừng toàn bộ PM2 processes trước build."
else
  echo "  Bỏ qua dừng PM2 trước build (DEPLOY_STOP_PM2_BEFORE_BUILD=${DEPLOY_STOP_PM2_BEFORE_BUILD})."
fi
echo "  DONE [6/15]"

echo "[7/15] Pre-build validation (lint + typecheck)"
if [[ "${DEPLOY_SKIP_LINT:-}" == "1" ]]; then
  echo "  Bỏ qua lint (DEPLOY_SKIP_LINT=1)."
else
  unset SKIP_ESLINT_ON_BUILD || true
  npm run lint
fi
if [[ "${DEPLOY_SKIP_TYPECHECK:-}" == "1" ]]; then
  echo "  Bỏ qua typecheck (DEPLOY_SKIP_TYPECHECK=1)."
else
  unset NEXT_BUILD_SKIP_TYPECHECK || true
  npx tsc --noEmit --pretty false
fi
echo "  DONE [7/15]"

echo "[8/15] Clean previous build artifacts"
rm -rf .next
echo "  DONE [8/15]"

echo "[9/15] Build app"
# Mặc định build đầy đủ để đảm bảo không bỏ qua lint/typecheck trong next build.
# Chỉ bật DEPLOY_BUILD_VPS=1 khi VPS quá yếu và đã xác nhận quality ở CI/máy khác.
if [[ "${DEPLOY_BUILD_VPS:-}" == "1" ]]; then
  echo "  DEPLOY_BUILD_VPS=1 → npm run build:vps (skip TypeScript trong bước build)."
  npm run build:vps
else
  # Ép bật lại full checks, tránh bị dính env cũ của shell (SKIP_ESLINT_ON_BUILD=1).
  SKIP_ESLINT_ON_BUILD=0 NEXT_BUILD_SKIP_TYPECHECK=0 npm run build:full
fi
echo "  DONE [9/15]"

echo "[10/15] Restart PM2 (--update-env: nạp lại biến môi trường)"
# Khôi phục các process đã lưu trước đó (nếu có), sau đó đảm bảo app chính + worker luôn chạy.
pm2 resurrect || true
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
echo "  DONE [10/15]"

echo "[11/15] Ensure cron jobs"
if [[ "${DEPLOY_SETUP_CRONS}" == "1" ]]; then
  mkdir -p /root/logs
  AI_SECRET="$(env_read MESSAGING_PARTNER_AI_CRON_SECRET)"
  CRON_SECRET_FALLBACK="$(env_read CRON_SECRET)"
  INV_SECRET="$(env_read MESSAGING_INVENTORY_EMBED_CRON_SECRET)"
  LOGO_SECRET="$(env_read MESSAGING_LOGO_CLEANUP_CRON_SECRET)"
  MKT_SECRET="$(env_read MESSAGING_PARTNER_MARKETING_CRON_SECRET)"
  WEDDING_SECRET="$(env_read WEDDING_REMINDER_CRON_SECRET)"

  if [[ -z "${AI_SECRET}" ]]; then AI_SECRET="${CRON_SECRET_FALLBACK}"; fi
  if [[ -z "${INV_SECRET}" ]]; then INV_SECRET="${AI_SECRET}"; fi
  if [[ -z "${LOGO_SECRET}" ]]; then LOGO_SECRET="${AI_SECRET}"; fi
  if [[ -z "${MKT_SECRET}" ]]; then MKT_SECRET="${AI_SECRET}"; fi

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

  if [[ -n "${MKT_SECRET}" ]]; then
    ensure_cron "partner-marketing-campaign" "* * * * * curl -fsS -m 280 -X POST http://127.0.0.1:3000/api/cron/partner-marketing-campaign -H \"Authorization: Bearer ${MKT_SECRET}\" >> /root/logs/partner-marketing-campaign.log 2>&1"
  else
    echo "  Cảnh báo: thiếu secret marketing cron, bỏ qua cron partner-marketing-campaign."
  fi

  if [[ -n "${WEDDING_SECRET}" ]]; then
    ensure_cron "wedding-reminder" "0 8 * * * curl -fsS -m 120 -X GET http://127.0.0.1:3000/api/cron/wedding-reminder -H \"Authorization: Bearer ${WEDDING_SECRET}\" >> /root/logs/wedding-reminder.log 2>&1"
  else
    echo "  Cảnh báo: thiếu WEDDING_REMINDER_CRON_SECRET, bỏ qua cron wedding-reminder."
  fi

  echo "  Cron hiện tại:"
  crontab -l | grep -E "messaging-partner-ai|messaging-inventory-embed-backfill|messaging-logo-cleanup|partner-marketing-campaign|wedding-reminder" || true
else
  echo "  Bỏ qua (DEPLOY_SETUP_CRONS=${DEPLOY_SETUP_CRONS})."
fi
echo "  DONE [11/15]"

echo "[12/15] ${DEPLOY_PM2_LOG_LINES} dòng log PM2 cuối → file + màn hình"
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
echo "  DONE [12/15]"

echo "[13/15] PM2 status"
pm2 status
echo "  DONE [13/15]"

echo "[14/15] Health check (HTTP app)"
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
echo "  DONE [14/15]"

echo "[15/15] Edge stack (nginx + domain công khai)"
if [[ "${DEPLOY_SKIP_EDGE_CHECK:-}" == "1" ]]; then
  echo "  Bỏ qua (DEPLOY_SKIP_EDGE_CHECK=1)."
else
  VERIFY_EDGE_AUTOFIX_NGINX=0 bash "${APP_DIR}/deploy/verify-edge-stack.sh"
fi
echo "  DONE [15/15]"

echo ""
echo "Hoàn tất. PM2 đang chạy bản build từ commit ${NEW_HEAD} (trùng origin/${BRANCH})."

if [[ "${DEPLOY_REBOOT_VPS:-}" == "1" ]]; then
  echo ""
  echo "DEPLOY_REBOOT_VPS=1 — khởi động lại máy VPS sau 10 giây (SSH sẽ ngắt)..."
  sleep 10
  sudo reboot
fi
