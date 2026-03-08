#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./deploy/update-vps.sh                # branch = main
#   ./deploy/update-vps.sh production     # custom branch

APP_DIR="/var/www/Thu-do-online"
APP_NAME="thu-do-online"
BRANCH="${1:-main}"

echo "[1/6] Go to app directory: ${APP_DIR}"
cd "${APP_DIR}"

echo "[2/6] Fetch latest code"
git fetch origin "${BRANCH}"

echo "[3/6] Checkout branch ${BRANCH}"
git checkout "${BRANCH}"
git reset --hard origin/"${BRANCH}"

echo "[4/6] Install dependencies"
npm install

echo "[5/6] Build app"
NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=4096}" npm run build

echo "[6/6] Restart PM2 process ${APP_NAME}"
if pm2 describe "${APP_NAME}" >/dev/null 2>&1; then
  pm2 restart "${APP_NAME}"
else
  pm2 start npm --name "${APP_NAME}" -- start
fi
pm2 save

echo "Done. Current status:"
pm2 status "${APP_NAME}" || true
