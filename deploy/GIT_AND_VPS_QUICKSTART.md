# Git + VPS Quickstart

## 1) Local: init and push to Git

```bash
cd g:/python-code/Thu-do-online
git init
git branch -M main
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/<username>/<repo>.git
git push -u origin main
```

## 2) VPS: first setup

```bash
# SSH vào VPS trước
ssh root@<your-vps-ip>

# Clone repo
mkdir -p /var/www
cd /var/www
git clone https://github.com/<username>/<repo>.git Thu-do-online
cd Thu-do-online

# Chạy setup lần đầu
chmod +x deploy/*.sh
sudo bash deploy/first-setup-vps.sh https://github.com/<username>/<repo>.git
```

Sau đó chỉnh `.env.local` trên VPS rồi:
```bash
pm2 restart thu-do-online
```

## 3) Daily update deploy

After local code changes:

```bash
git add .
git commit -m "your message"
git push
```

On VPS:

```bash
cd /var/www/Thu-do-online
bash deploy/update-vps.sh main
```

VPS RAM thấp mà build vẫn bị «Killed»:

```bash
cd /var/www/Thu-do-online
git pull origin main
DEPLOY_DELETE_PM2_BEFORE_BUILD=1 \
DEPLOY_STOP_PM2_BEFORE_BUILD=1 \
DEPLOY_BUILD_VPS=1 \
DEPLOY_SKIP_LINT=1 \
DEPLOY_SKIP_TYPECHECK=1 \
NODE_BUILD_HEAP_MB=3072 \
bash deploy/update-vps.sh main
```

Script tự `pm2 delete all` trước build (giải phóng RAM), build xong start lại **NanoAI + 188** (`deploy/ecosystem.config.cjs` trong `/var/www/188.com.vn`). Không cần `pm2 delete all` thủ công trước khi chạy script.

Nếu chỉ thiếu RAM vừa phải: bỏ `DEPLOY_DELETE_PM2_BEFORE_BUILD=1` (mặc định chỉ `pm2 stop all`).

## 4) PM2 check

```bash
pm2 status
pm2 logs thu-do-online --lines 100
```
