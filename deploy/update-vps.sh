#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./deploy/update-vps.sh                # branch = main
#   ./deploy/update-vps.sh production     # custom branch
#
# Admin «deploy» / «deploy VPS» / «chạy update-vps» = chạy FILE NÀY ĐẦY ĐỦ
# (lint + typecheck ở [7/15], rồi build:full không chạy lại lint/tsc + PM2 + 188 + cron + health + nginx).
# Không bật DEPLOY_SKIP_LINT / DEPLOY_SKIP_TYPECHECK / DEPLOY_BUILD_VPS
# trừ khi admin nói rõ bỏ bước đó.
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
#   DEPLOY_STOP_PM2_BEFORE_BUILD=1  Dừng/xóa PM2 trước lint/typecheck/build để giải phóng RAM (mặc định bật)
#   DEPLOY_DELETE_PM2_BEFORE_BUILD=1  pm2 delete all trước build (mặc định bật); NanoAI start sau build, 188 start sau khi NanoAI health OK
#   NODE_OPTIONS=--max-old-space-size=4096  Heap Node cho lint/typecheck/build (script tự set nếu chưa có)
#   DEPLOY_188_APP_DIR=/var/www/188.com.vn  Thư mục repo 188 (ecosystem: deploy/ecosystem.config.cjs)
#   DEPLOY_SKIP_MIGRATIONS=1  Bỏ qua bước chạy migration SQL mới
#   DEPLOY_SETUP_CRONS=1  Tự đảm bảo cron AI/inventory/logo cleanup + nhắc lịch đám cưới (mặc định bật)
#   DEPLOY_SKIP_188_RESTART=1  Không khởi động lại 188-web / 188-api sau deploy NanoAI
#
# Script này sẽ:
# - pull code mới nhất từ origin/<branch>
# - chạy migration SQL trong db/migrations/ theo checksum:
#   + file mới: tự chạy
#   + file đã sửa nội dung: tự chạy lại
# - build + start PM2 NanoAI (thu-do-online + worker), health OK → mới start 188-web / 188-api
# - đảm bảo các cron chính (messaging + nhắc lịch đám cưới)

APP_DIR="/var/www/Thu-do-online"
APP_NAME="thu-do-online"
BRANCH="${1:-main}"
DEPLOY_HEALTHCHECK_URL="${DEPLOY_HEALTHCHECK_URL:-http://127.0.0.1:3000/}"
DEPLOY_HEALTHCHECK_RETRIES="${DEPLOY_HEALTHCHECK_RETRIES:-15}"
DEPLOY_PM2_LOG_LINES="${DEPLOY_PM2_LOG_LINES:-100}"
DEPLOY_STOP_PM2_BEFORE_BUILD="${DEPLOY_STOP_PM2_BEFORE_BUILD:-1}"
DEPLOY_DELETE_PM2_BEFORE_BUILD="${DEPLOY_DELETE_PM2_BEFORE_BUILD:-1}"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=4096}"
DEPLOY_188_APP_DIR="${DEPLOY_188_APP_DIR:-/var/www/188.com.vn}"
LOG_DIR="${APP_DIR}/deploy/logs"
DEPLOY_SETUP_CRONS="${DEPLOY_SETUP_CRONS:-1}"
MIGRATION_STATE_FILE="${APP_DIR}/deploy/applied-migrations.sha256"
DEPLOY_LOCK_FILE="${APP_DIR}/deploy/.deploy-in-progress.lock"
# 188 watchdog-api/web skip recover when this file exists (age < 2h).
DEPLOY_188_LOCK_FILE="${DEPLOY_188_APP_DIR}/deploy/.deploy-in-progress"

acquire_deploy_lock() {
  if [[ -f "${DEPLOY_LOCK_FILE}" ]]; then
    echo "LỖI: Deploy khác đang chạy (lock: ${DEPLOY_LOCK_FILE}). Chỉ chạy một deploy VPS tại một thời điểm." >&2
    exit 1
  fi
  mkdir -p "$(dirname "${DEPLOY_LOCK_FILE}")"
  echo "$$ $(date -Is)" > "${DEPLOY_LOCK_FILE}"
  mkdir -p "$(dirname "${DEPLOY_188_LOCK_FILE}")"
  echo "nanoai $$ $(date -Is)" > "${DEPLOY_188_LOCK_FILE}"
  echo "  188 watchdog lock: ${DEPLOY_188_LOCK_FILE}"
  trap 'rm -f "${DEPLOY_LOCK_FILE}"; if grep -q "^nanoai " "${DEPLOY_188_LOCK_FILE}" 2>/dev/null; then rm -f "${DEPLOY_188_LOCK_FILE}"; fi' EXIT
}

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

# Tắt toàn bộ PM2 + build tay + process mồ côi — không app web nào chạy trong lúc lint/build.
stop_all_apps_for_deploy() {
  echo "  NODE_OPTIONS=${NODE_OPTIONS}"
  echo "  Dừng mọi next build / PM2 / app NanoAI + 188..."
  pkill -f "next build" 2>/dev/null || true
  pkill -f "next/dist/bin/next build" 2>/dev/null || true
  pkill -f "next start" 2>/dev/null || true
  if [[ "${DEPLOY_STOP_PM2_BEFORE_BUILD}" == "1" ]]; then
    if [[ "${DEPLOY_DELETE_PM2_BEFORE_BUILD}" == "1" ]]; then
      pm2 delete all 2>/dev/null || true
      pm2 save --force 2>/dev/null || true
      echo "  pm2 delete all — không còn process PM2 (dump PM2 đã xóa sạch)."
    else
      pm2 stop all 2>/dev/null || true
      pm2 save --force 2>/dev/null || true
      echo "  pm2 stop all."
    fi
  fi
  pkill -f "${APP_DIR}/node_modules/.bin/next" 2>/dev/null || true
  pkill -f "${APP_DIR}/.next" 2>/dev/null || true
  pkill -f "${DEPLOY_188_APP_DIR}/frontend" 2>/dev/null || true
  pkill -f "${DEPLOY_188_APP_DIR}/backend" 2>/dev/null || true
  sleep 2
  if command -v fuser >/dev/null 2>&1; then
    for port in 3000 3001 8001; do
      fuser -k "${port}/tcp" 2>/dev/null || true
    done
    echo "  Đã giải phóng port 3000/3001/8001."
  fi
  rm -rf .next
  sync || true
  sleep 1
}

apps_still_running() {
  local port
  for port in 3000 3001 8001; do
    if ss -tlnp 2>/dev/null | grep -q ":${port} "; then
      return 0
    fi
  done
  if pm2 status 2>/dev/null | grep -qE 'online|waiting|launching|stopping'; then
    return 0
  fi
  return 1
}

assert_no_app_listeners() {
  local attempt
  for attempt in 1 2 3 4 5; do
    if ! apps_still_running; then
      echo "  OK: PM2 trống, 3000/3001/8001 không listen."
      free -m 2>/dev/null | head -2 || free -h | head -2
      return 0
    fi
    echo "  Còn app/port — dừng lại lần ${attempt}/5 (188 watchdog có thể vừa phục hồi)..."
    stop_all_apps_for_deploy
  done
  echo "LỖI: PM2/port vẫn còn app — từ chối deploy khi web/188 còn chạy." >&2
  pm2 status || true
  ss -tlnp 2>/dev/null | grep -E ':3000 |:3001 |:8001 ' || true
  exit 1
}

# Sau build: restart 188 nếu còn trong PM2; nếu đã pm2 delete all thì start deploy/ecosystem.config.cjs.
ensure_188_pm2_online() {
  local dir="${DEPLOY_188_APP_DIR}"
  local eco="${dir}/deploy/ecosystem.config.cjs"
  local missing=0
  for name in 188-web 188-api; do
    if ! pm2 describe "${name}" >/dev/null 2>&1; then
      missing=1
      break
    fi
  done
  if [[ "${missing}" -eq 1 ]]; then
    if [[ ! -f "${eco}" ]]; then
      echo "  Cảnh báo: không tìm thấy ${eco} — không start được 188.com.vn."
      return 1
    fi
    echo "  Start 188.com.vn từ ${eco}..."
    pm2 start "${eco}" --update-env
    return 0
  fi
  for name in 188-web 188-api; do
    echo "  Restart ${name} (188.com.vn)."
    pm2 restart "${name}" --update-env
  done
  return 0
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
acquire_deploy_lock
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

echo "[4/15] Stop all apps — không chạy web/188 trong suốt deploy"
stop_all_apps_for_deploy
assert_no_app_listeners
echo "  NanoAI + 188 sẽ start lại sau build (188 sau health OK)."
echo "  DONE [4/15]"

echo "[5/15] Install dependencies (lockfile-first)"
if [[ -f "package-lock.json" ]]; then
  npm ci
else
  npm install
fi
echo "  DONE [5/15]"

echo "[6/15] Apply SQL migrations (new + modified)"
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
echo "  DONE [6/15]"

echo "[7/15] Pre-build validation (lint + typecheck)"
stop_all_apps_for_deploy
assert_no_app_listeners
# Xóa .next cũ trước typecheck — tránh TS2307 từ .next/types của route đã xóa.
rm -rf .next
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
stop_all_apps_for_deploy
assert_no_app_listeners
# Lint + tsc đã chạy ở [7/15]. next build không chạy lại (trùng, tốn CPU).
# Chỉ bật DEPLOY_BUILD_VPS=1 khi VPS quá yếu và đã xác nhận quality ở CI/máy khác.
if [[ "${DEPLOY_BUILD_VPS:-}" == "1" ]]; then
  echo "  DEPLOY_BUILD_VPS=1 → npm run build:vps (skip TypeScript trong bước build)."
  npm run build:vps
else
  echo "  Lint + tsc đã xong ở [7/15] — next build bỏ lint/typecheck trùng."
  SKIP_ESLINT_ON_BUILD=1 NEXT_BUILD_SKIP_TYPECHECK=1 npm run build:full
fi
echo "  DONE [9/15]"

echo "[10/15] Start NanoAI PM2 (thu-do-online + worksheet-worker)"
# Chỉ khởi động NanoAI — 188 start ở bước 15 sau khi health NanoAI OK.
# Khởi động next binary trực tiếp (không qua npm) để max_memory_restart bắt đúng heap.
# Tránh process «online giả» khi chỉ npm cha còn sống sau OOM.
if [[ -f "${APP_DIR}/ecosystem.config.cjs" ]]; then
  pm2 delete thu-do-online worksheet-worker >/dev/null 2>&1 || true
  pm2 start "${APP_DIR}/ecosystem.config.cjs" --update-env
else
  echo "  Cảnh báo: thiếu ecosystem.config.cjs — fallback npm start."
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
fi
pm2 save
echo "  DONE [10/15]"

echo "[11/15] Ensure cron jobs"
if [[ "${DEPLOY_SETUP_CRONS}" == "1" ]]; then
  mkdir -p /root/logs /tmp/nanoai-cron-locks
  AI_SECRET="$(env_read MESSAGING_PARTNER_AI_CRON_SECRET)"
  CRON_SECRET_FALLBACK="$(env_read CRON_SECRET)"
  INV_SECRET="$(env_read MESSAGING_INVENTORY_EMBED_CRON_SECRET)"
  CATALOG_SECRET="$(env_read MESSAGING_EXTERNAL_CATALOG_CRON_SECRET)"
  LOGO_SECRET="$(env_read MESSAGING_LOGO_CLEANUP_CRON_SECRET)"
  MKT_SECRET="$(env_read MESSAGING_PARTNER_MARKETING_CRON_SECRET)"
  WEDDING_SECRET="$(env_read WEDDING_REMINDER_CRON_SECRET)"
  PARTNER_SSL_SECRET="$(env_read PARTNER_DOMAIN_SSL_CRON_SECRET)"

  if [[ -z "${AI_SECRET}" ]]; then AI_SECRET="${CRON_SECRET_FALLBACK}"; fi
  if [[ -z "${INV_SECRET}" ]]; then INV_SECRET="${AI_SECRET}"; fi
  if [[ -z "${CATALOG_SECRET}" ]]; then CATALOG_SECRET="${INV_SECRET}"; fi
  if [[ -z "${LOGO_SECRET}" ]]; then LOGO_SECRET="${AI_SECRET}"; fi
  if [[ -z "${MKT_SECRET}" ]]; then MKT_SECRET="${AI_SECRET}"; fi
  if [[ -z "${PARTNER_SSL_SECRET}" ]]; then PARTNER_SSL_SECRET="${CRON_SECRET_FALLBACK}"; fi

  # Gỡ cron Vision đã remove khỏi codebase (tránh POST treo khi app yếu).
  (crontab -l 2>/dev/null | grep -vE 'vision-catalog-sync|vision-bg-sync-enqueue|vision-warehouse-reindex' || true) | crontab - || true

  if [[ -n "${AI_SECRET}" ]]; then
    ensure_cron "messaging-partner-ai" "* * * * * curl -fsS -m 90 -X POST http://127.0.0.1:3000/api/cron/messaging-partner-ai -H \"Authorization: Bearer ${AI_SECRET}\" >> /root/logs/messaging-partner-ai.log 2>&1"
  else
    echo "  Cảnh báo: thiếu MESSAGING_PARTNER_AI_CRON_SECRET/CRON_SECRET, bỏ qua cron messaging-partner-ai."
  fi

  if [[ -n "${INV_SECRET}" ]]; then
    # 1 lần/ngày 03:20 VN — backfill vector ảnh/chữ. flock tránh chồng nếu lượt trước chưa xong.
    ensure_cron "messaging-inventory-embed-backfill" "20 3 * * * flock -n /tmp/nanoai-cron-locks/inventory-embed.lock -c 'curl -fsS -m 600 -X POST http://127.0.0.1:3000/api/cron/messaging-inventory-embed-backfill -H \"Authorization: Bearer ${INV_SECRET}\"' >> /root/logs/inventory-embed-backfill.log 2>&1"
  else
    echo "  Cảnh báo: thiếu secret inventory cron, bỏ qua cron inventory-embed-backfill."
  fi

  if [[ -n "${CATALOG_SECRET}" ]]; then
    # 1 lần/ngày 03:05 VN — dò shop tới hạn (engine đã chốt 1 ngày/shop sau giờ VN).
    ensure_cron "messaging-external-catalog-sync" "5 3 * * * curl -fsS -m 600 -X POST http://127.0.0.1:3000/api/cron/messaging-external-catalog-sync -H \"Authorization: Bearer ${CATALOG_SECRET}\" >> /root/logs/messaging-external-catalog-sync.log 2>&1"
  else
    echo "  Cảnh báo: thiếu secret catalog cron, bỏ qua cron messaging-external-catalog-sync."
  fi

  if [[ -n "${LOGO_SECRET}" ]]; then
    ensure_cron "messaging-logo-cleanup" "30 3 * * * curl -fsS -m 120 -X POST http://127.0.0.1:3000/api/cron/messaging-logo-cleanup -H \"Authorization: Bearer ${LOGO_SECRET}\" >> /root/logs/messaging-logo-cleanup.log 2>&1"
  else
    echo "  Cảnh báo: thiếu secret logo cleanup cron, bỏ qua cron messaging-logo-cleanup."
  fi

  if [[ -n "${MKT_SECRET}" ]]; then
    ensure_cron "partner-marketing-campaign" "* * * * * curl -fsS -m 280 -X POST http://127.0.0.1:3000/api/cron/partner-marketing-campaign -H \"Authorization: Bearer ${MKT_SECRET}\" >> /root/logs/partner-marketing-campaign.log 2>&1"
    ensure_cron "partner-customer-notifications" "* * * * * curl -fsS -m 160 -X POST http://127.0.0.1:3000/api/cron/partner-customer-notifications -H \"Authorization: Bearer ${MKT_SECRET}\" >> /root/logs/partner-customer-notifications.log 2>&1"
  else
    echo "  Cảnh báo: thiếu secret marketing cron, bỏ qua cron partner-marketing-campaign."
  fi

  if [[ -n "${CRON_SECRET_FALLBACK}" ]]; then
    ensure_cron "partner-marketing-banners" "25 2 * * * curl -fsS -m 300 -X POST http://127.0.0.1:3000/api/cron/partner-marketing-banners -H \"Authorization: Bearer ${CRON_SECRET_FALLBACK}\" >> /root/logs/partner-marketing-banners.log 2>&1"
    ensure_cron "partner-email-daily" "0 9 * * * curl -fsS -m 300 -X POST http://127.0.0.1:3000/api/cron/partner-email-daily -H \"Authorization: Bearer ${CRON_SECRET_FALLBACK}\" >> /root/logs/partner-email-daily.log 2>&1"
  else
    echo "  Cảnh báo: thiếu CRON_SECRET, bỏ qua cron partner-marketing-banners / partner-email-daily."
  fi

  if [[ -n "${WEDDING_SECRET}" ]]; then
    ensure_cron "wedding-reminder" "0 8 * * * curl -fsS -m 120 -X GET http://127.0.0.1:3000/api/cron/wedding-reminder -H \"Authorization: Bearer ${WEDDING_SECRET}\" >> /root/logs/wedding-reminder.log 2>&1"
  else
    echo "  Cảnh báo: thiếu WEDDING_REMINDER_CRON_SECRET, bỏ qua cron wedding-reminder."
  fi

  if [[ -n "${PARTNER_SSL_SECRET}" ]]; then
    ensure_cron "partner-custom-domain-ssl" "*/3 * * * * curl -fsS -m 300 -X POST http://127.0.0.1:3000/api/cron/partner-custom-domain-ssl -H \"Authorization: Bearer ${PARTNER_SSL_SECRET}\" >> /root/logs/partner-custom-domain-ssl.log 2>&1"
  else
    echo "  Cảnh báo: thiếu PARTNER_DOMAIN_SSL_CRON_SECRET/CRON_SECRET, bỏ qua cron partner-custom-domain-ssl."
  fi

  echo "  Cron hiện tại:"
  crontab -l | grep -E "messaging-partner-ai|messaging-inventory-embed-backfill|messaging-external-catalog-sync|messaging-logo-cleanup|partner-marketing-campaign|partner-customer-notifications|partner-marketing-banners|partner-email-daily|wedding-reminder|partner-custom-domain-ssl|vision-" || true
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
  for name in 188-web 188-api; do
    if pm2 describe "${name}" >/dev/null 2>&1; then
      echo ""
      echo "========== ${name} (188.com.vn) =========="
      pm2 logs "${name}" --lines "${DEPLOY_PM2_LOG_LINES}" --nostream 2>&1 || true
    fi
  done
} | tee "${PM2_LOG_SNAPSHOT}"
echo ""
echo "  Đã lưu: ${PM2_LOG_SNAPSHOT}"
echo "  DONE [12/15]"

echo "[13/15] PM2 status"
pm2 status
echo "  DONE [13/15]"

echo "[14/15] Health check NanoAI (HTTP :3000)"
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
    echo "  Chờ NanoAI lên... (${i}/${DEPLOY_HEALTHCHECK_RETRIES})"
    sleep 2
  done
  if [[ "${ok}" -ne 1 ]]; then
    echo "LỖI: Health check NanoAI thất bại sau ${DEPLOY_HEALTHCHECK_RETRIES} lần: ${DEPLOY_HEALTHCHECK_URL}" >&2
    echo "  188 chưa được khởi động (chờ NanoAI OK)." >&2
    echo "  Gợi ý: pm2 logs thu-do-online --lines 80" >&2
    exit 1
  fi
fi
echo "  DONE [14/15]"

echo "[15/15] Start 188 + edge stack (nginx + domain)"
if [[ "${DEPLOY_SKIP_188_RESTART:-}" != "1" ]]; then
  echo "  NanoAI đã OK — khởi động 188.com.vn..."
  if ensure_188_pm2_online; then
    pm2 save
    if curl -fsS --max-time 15 -o /dev/null "http://127.0.0.1:3001/" 2>/dev/null; then
      echo "  OK: http://127.0.0.1:3001/ (188-web)"
    else
      echo "  Cảnh báo: 188-web chưa phản hồi :3001 — thử: cd /var/www/188.com.vn && bash deploy/fix-web-health.sh"
    fi
    if curl -fsS --max-time 15 -o /dev/null "http://127.0.0.1:8001/health" 2>/dev/null; then
      echo "  OK: http://127.0.0.1:8001/health (188-api)"
    else
      echo "  Cảnh báo: 188-api chưa phản hồi :8001 — thử: cd /var/www/188.com.vn && bash deploy/fix-api-health.sh"
    fi
  fi
else
  echo "  Bỏ qua khởi động 188 (DEPLOY_SKIP_188_RESTART=1)."
fi
if [[ "${DEPLOY_SKIP_EDGE_CHECK:-}" == "1" ]]; then
  echo "  Bỏ qua edge check (DEPLOY_SKIP_EDGE_CHECK=1)."
else
  VERIFY_EDGE_AUTOFIX_NGINX=0 bash "${APP_DIR}/deploy/verify-edge-stack.sh"
fi
echo "  DONE [15/15]"

echo ""
echo "Hoàn tất. NanoAI + 188 (nếu bật) từ commit ${NEW_HEAD} (trùng origin/${BRANCH})."

if [[ "${DEPLOY_REBOOT_VPS:-}" == "1" ]]; then
  echo ""
  echo "DEPLOY_REBOOT_VPS=1 — khởi động lại máy VPS sau 10 giây (SSH sẽ ngắt)..."
  sleep 10
  sudo reboot
fi
