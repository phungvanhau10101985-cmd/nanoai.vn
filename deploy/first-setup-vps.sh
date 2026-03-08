#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   sudo bash deploy/first-setup-vps.sh https://github.com/<user>/<repo>.git

if [ "${EUID}" -ne 0 ]; then
  echo "Please run as root (sudo)." >&2
  exit 1
fi

if [ $# -lt 1 ]; then
  echo "Missing repo URL."
  echo "Example: sudo bash deploy/first-setup-vps.sh https://github.com/<user>/<repo>.git"
  exit 1
fi

REPO_URL="$1"
APP_DIR="/var/www/Thu-do-online"
APP_NAME="thu-do-online"

echo "[1/10] Update apt and install base packages"
apt update
apt install -y build-essential python3 python3-pip git curl nginx

echo "[2/10] Install Python packages (rembg, pillow) for sticker & xoa-nen-png"
pip3 install "rembg[cpu,cli]" pillow || true

echo "[3/10] Install Node.js 20 LTS"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

echo "[4/10] Install PM2"
npm install -g pm2

echo "[5/10] Prepare app directory"
mkdir -p /var/www
cd /var/www
if [ ! -d "${APP_DIR}" ]; then
  git clone "${REPO_URL}" "${APP_DIR}"
elif [ ! -d "${APP_DIR}/.git" ]; then
  echo "Directory ${APP_DIR} exists but is not a git repository." >&2
  echo "Please backup/remove it, then run this script again." >&2
  exit 1
fi

echo "[6/10] Create .env.local if missing"
cd "${APP_DIR}"
if [ ! -f ".env.local" ]; then
  cp .env.example .env.local
  echo "Created ${APP_DIR}/.env.local from .env.example"
  echo "Edit .env.local before running production."
fi

echo "[7/10] Install dependencies and build"
npm install
NODE_OPTIONS="--max-old-space-size=4096" npm run build

echo "[8/10] Start app with PM2"
if pm2 describe "${APP_NAME}" >/dev/null 2>&1; then
  pm2 restart "${APP_NAME}"
else
  pm2 start npm --name "${APP_NAME}" -- start
fi
pm2 save
pm2 startup systemd -u root --hp /root || true

echo "[9/10] Enable Nginx site (manual server_name check still needed)"
if [ -f "${APP_DIR}/deploy/nginx-nanoai.conf" ]; then
  cp "${APP_DIR}/deploy/nginx-nanoai.conf" /etc/nginx/sites-available/nanoai
  ln -sf /etc/nginx/sites-available/nanoai /etc/nginx/sites-enabled/nanoai
  nginx -t && systemctl reload nginx
fi

echo "[10/10] Done"
echo "Remember to set real values in ${APP_DIR}/.env.local and restart:"
echo "pm2 restart ${APP_NAME}"
