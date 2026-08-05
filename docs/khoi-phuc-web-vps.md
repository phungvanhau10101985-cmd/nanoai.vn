# Khôi phục nhanh khi web bị sập (VPS NanoAI)

Hướng dẫn cho server chạy **nhiều web** trên cùng VPS: `nanoai.vn` + `188.com.vn`.

---

## Quy trình chọn (đọc trước)

| Tình huống | Làm gì |
|------------|--------|
| **Không rõ** site nào hỏng / **nhiều domain** cùng chết | Luôn **[§2 Khôi phục toàn server](#2-khôi-phục-toàn-server)** trước: Nginx sạch → PM2 cả 4 process → `curl` 2 domain |
| Chỉ **nanoai.vn** lỗi (188 OK) | **[§3 Khôi phục riêng nanoai.vn](#3-khôi-phục-riêng-nanoaivn)** |
| Chỉ **188.com.vn** lỗi (nanoai OK) | **[§4 Khôi phục riêng 188.com.vn](#4-khôi-phục-riêng-188comvn)** |
| `nginx -t` fail | **[§5 Nginx lỗi config](#5-nginx-lỗi-config-nginx--t-fail)** |

**Tóm lại:** Web sập không rõ nguyên nhân → **toàn server trước**. Nếu sau đó chỉ một domain lỗi → **khôi phục riêng** + script fix/verify của site đó.

---

## Hiểu nhanh: vì sao «PM2 OK» nhưng domain chết?

| Lớp | Thành phần | Khi lỗi |
|-----|------------|---------|
| **App** | PM2: `thu-do-online`, `worksheet-worker`, `188-web`, `188-api` | Chỉ web tương ứng (port nội bộ) |
| **Edge** | **Một** Nginx (80/443) + file trong `sites-enabled` | **Tất cả domain** có thể chết cùng lúc |

| Site | Port nội bộ (VPS) | Ghi chú |
|------|-------------------|---------|
| **nanoai.vn** | App `:3000` | Không dùng 3000 cho 188 |
| **188.com.vn** | Web Next `:3001`, API `:8001` | Health API: `http://127.0.0.1:8001/health` |

Deploy `deploy/update-vps.sh` (Thu-do-online) mặc định check `http://127.0.0.1:3000/` — **không đủ** cho domain public. Dùng `deploy/verify-edge-stack.sh` (bước 15/15).

**Case thực tế:** file `188.com.vn.save` (typo `dffgf`) trong `sites-enabled` → reboot/restart Nginx → mọi HTTPS chết, `:3000` vẫn OK.

---

## 1. Kiểm tra nhanh (~30 giây)

SSH `root@nanoai`:

```bash
cd /var/www/Thu-do-online
pm2 status

# NanoAI
curl -fsS -o /dev/null -w "nanoai-app=%{http_code}\n" http://127.0.0.1:3000/ || echo "nanoai-app=FAIL"

# 188 — cổng riêng (3001 web, 8001 API)
curl -fsS -o /dev/null -w "188-local-web=%{http_code}\n" http://127.0.0.1:3001/ || echo "188-local-web=FAIL"
curl -fsS -o /dev/null -w "188-local-api=%{http_code}\n" http://127.0.0.1:8001/health || echo "188-local-api=FAIL"

# Nginx + domain public
curl -fsS -o /dev/null -w "nginx80=%{http_code}\n" http://127.0.0.1/ || echo "nginx80=FAIL"
curl -fsS -o /dev/null -w "nanoai-web=%{http_code}\n" https://nanoai.vn/ || echo "nanoai-web=FAIL"
curl -fsS -o /dev/null -w "188-public=%{http_code}\n" https://188.com.vn/ || echo "188-public=FAIL"

systemctl is-active nginx || echo "nginx=FAIL"
sudo nginx -t 2>&1 | tail -3
```

| Kết quả | Ý nghĩa |
|---------|---------|
| `nanoai-app=FAIL` | Lỗi `thu-do-online` |
| `188-local-web=FAIL` hoặc mã `000` | Lỗi `188-web` / chưa listen `:3001` |
| `188-local-api=FAIL` hoặc mã `000` | Lỗi `188-api` / chưa listen `:8001` |
| `nginx80=FAIL` hoặc **cả hai** domain public FAIL | Lỗi **Nginx** (hoặc firewall 80/443) |
| Chỉ một domain public FAIL | Khôi phục riêng site đó (§3 hoặc §4) |

```bash
bash /var/www/Thu-do-online/deploy/verify-edge-stack.sh
```

---

## 2. Khôi phục toàn server

Dùng khi **nhiều domain chết** hoặc **chưa biết** site nào hỏng.

```bash
# 1) Nginx — ảnh hưởng MỌI web
sudo find /etc/nginx/sites-enabled -maxdepth 1 \
  \( -name '*.save' -o -name '*.bak' -o -name '*.tmp' -o -name '*~' \) \
  -exec sudo mv {} /etc/nginx/sites-available/ \; 2>/dev/null

sudo nginx -t
sudo systemctl start nginx
sudo systemctl enable nginx

# 2) PM2 — cả 4 process
pm2 restart thu-do-online worksheet-worker 188-web 188-api
pm2 save

# 3) Kiểm tra public
curl -fsS -I https://nanoai.vn/ | head -3
curl -fsS -I https://188.com.vn/ | head -3
```

**Một dòng gộp:**

```bash
cd /var/www/Thu-do-online && \
sudo find /etc/nginx/sites-enabled -maxdepth 1 \( -name '*.save' -o -name '*.bak' \) \
  -exec sudo mv {} /etc/nginx/sites-available/ \; 2>/dev/null; \
sudo nginx -t && sudo systemctl start nginx && \
pm2 restart thu-do-online worksheet-worker 188-web 188-api && pm2 save && \
curl -fsS -I https://nanoai.vn/ | head -3 && curl -fsS -I https://188.com.vn/ | head -3
```

Nếu vẫn lỗi từng site → xuống §3 / §4.

---

## 3b. Root cause đã gặp: Next.js heap OOM → 504

Triệu chứng: PM2 `online`, `↺=0`, nhưng `curl 127.0.0.1:3000` treo / Nginx `upstream timed out`.

Nguyên nhân gốc (2026-08-05):
- `next-server` `FATAL ERROR: JavaScript heap out of memory` (~2GB)
- PM2 theo dõi `npm start` (cha) → không restart khi con OOM
- Auto-embed inventory + cron embed chồng tải
- Cron Vision cũ vẫn gọi route đã remove

Khắc phục trong code: `ecosystem.config.cjs` + giảm batch embed + stub vision cron + flock.

Áp dụng ngay trên VPS (sau khi `git pull`):

```bash
cd /var/www/Thu-do-online
pkill -f '/usr/share/apport/apport' 2>/dev/null || true
pm2 delete thu-do-online worksheet-worker 2>/dev/null || true
pm2 start ecosystem.config.cjs && pm2 save
crontab -l | grep -vE 'vision-catalog-sync|vision-bg-sync-enqueue|vision-warehouse-reindex' | crontab - || true
timeout 8 curl -s -o /dev/null -w "nanoai=%{http_code}\n" http://127.0.0.1:3000/
```

Hoặc full deploy: `bash deploy/update-vps.sh main`.

---

## 3. Khôi phục riêng nanoai.vn

**Khi:** `https://188.com.vn` OK, chỉ `nanoai.vn` hoặc `:3000` lỗi.

```bash
cd /var/www/Thu-do-online

pm2 restart thu-do-online worksheet-worker
pm2 save

curl -fsS -I http://127.0.0.1:3000/ | head -3
curl -fsS -I https://nanoai.vn/ | head -3

bash deploy/verify-edge-stack.sh
```

Nginx vẫn cần active (nếu domain public fail mà `:3000` OK):

```bash
sudo nginx -t && sudo systemctl start nginx
```

**Deploy code mới** (không nhầm với khôi phục nhanh):

```bash
cd /var/www/Thu-do-online
bash deploy/update-vps.sh main
```

Build lại nếu thiếu `.next` / lỗi sau deploy:

```bash
cd /var/www/Thu-do-online
NODE_OPTIONS="--max-old-space-size=4096" npm run build
pm2 restart thu-do-online worksheet-worker
pm2 save
```

---

## 4. Khôi phục riêng 188.com.vn

**Khi:** `https://nanoai.vn` OK, chỉ `188.com.vn` hoặc cổng 188 lỗi.

**Cổng trong repo 188 (VPS):**

| Thành phần | Port | Health |
|------------|------|--------|
| Web Next (`188-web`) | **:3001** | `http://127.0.0.1:3001/` — **không** dùng 3000 (3000 là nanoai) |
| API (`188-api`) | **:8001** | `http://127.0.0.1:8001/health` |

```bash
cd /var/www/188.com.vn

pm2 restart 188-web 188-api
pm2 save

curl -fsS -o /dev/null -w "web=%{http_code}\n" http://127.0.0.1:3001/
curl -fsS -o /dev/null -w "api=%{http_code}\n" http://127.0.0.1:8001/health
curl -fsS -I https://188.com.vn/ | head -3
```

### curl nội bộ trả `000` (không kết nối TCP)

Dùng script có sẵn trong repo **188** (`/var/www/188.com.vn`):

```bash
cd /var/www/188.com.vn

bash deploy/fix-web-health.sh   # web = 000 / không listen :3001
bash deploy/fix-api-health.sh   # api = 000 hoặc CPU 100% / treo startup
```

### Deploy code mới 188 (không nhầm với khôi phục nhanh)

```bash
cd /var/www/188.com.vn
bash deploy/update-vps.sh main
```

(Log tên script có thể là `update-vps.sh` — chạy trong thư mục 188, **không** chạy script Thu-do-online.)

### Log khi API lỗi

```bash
pm2 logs 188-api --err --lines 30 --nostream
pm2 logs 188-web --lines 30 --nostream
```

---

## 5. Nginx lỗi config (`nginx -t` fail)

```bash
sudo nginx -t
sudo grep -rn "dffgf\|unknown directive" /etc/nginx/sites-enabled/ /etc/nginx/sites-available/

ls -la /etc/nginx/sites-enabled/
# Chỉ symlink / file .conf sạch — KHÔNG *.save / *.bak

sudo nano /etc/nginx/sites-available/TÊN_SITE

sudo nginx -t && sudo systemctl restart nginx
sudo systemctl status nginx --no-pager
```

Backup chỉ để `/etc/nginx/sites-available/`, **không** trong `sites-enabled/`.

---

## 6. Những gì khôi phục nhanh **không** sửa được

| Vấn đề | Cần làm thêm |
|--------|----------------|
| **`188-api` CPU 100%** | `pm2 restart 188-api` có thể tạm hết; xem `pm2 logs 188-api --err --lines 30`; có thể cần `fix-api-health.sh` |
| **Thiếu build** (frontend `.next` / build app) | `npm run build` + deploy — **không** chỉ `pm2 restart` |
| **Lỗi DB / migration kẹt** (188) | `deploy/fix-api-health.sh` hoặc `deploy/update-vps.sh` trong repo 188 |
| **Deploy code mới** | `bash deploy/update-vps.sh main` **đúng thư mục** từng project |
| **SSL hết hạn** | `sudo certbot renew` / `certbot --nginx` |
| **DNS / firewall Vietnix** | Panel VPS + `ufw` / security group |

---

## 7. Giám sát tự động (cron) — monitor **cả hai** domain

Cron gộp phát hiện sớm «một site chết im lặng».

### Tạo `/root/check-all-sites.sh`

```bash
cat > /root/check-all-sites.sh << 'EOF'
#!/usr/bin/env bash
set -euo pipefail
LOG="${LOG:-/root/logs/edge-stack-verify.log}"
mkdir -p "$(dirname "$LOG")"
{
  echo "=== check-all-sites $(date -Is) ==="
  /var/www/Thu-do-online/deploy/verify-edge-stack.sh
  curl -fsS -m 20 -o /dev/null https://188.com.vn/
  curl -fsS -m 10 -o /dev/null http://127.0.0.1:3001/
  curl -fsS -m 10 -o /dev/null http://127.0.0.1:8001/health
  echo "PASS: nanoai edge + 188 public + 188 local ports"
} >> "$LOG" 2>&1
EOF

chmod +x /root/check-all-sites.sh
```

### Crontab (mỗi 5 phút)

```bash
mkdir -p /root/logs
(crontab -l 2>/dev/null | grep -v -E 'check-all-sites|verify-edge-stack'
 echo '*/5 * * * * /root/check-all-sites.sh') | crontab -

crontab -l | grep check-all-sites
```

Log:

```bash
tail -40 /root/logs/edge-stack-verify.log
```

**Lưu ý:** Cron **phát hiện** lỗi; config Nginx hỏng vẫn cần SSH + §2 / §5.

### Chỉ nanoai (tối thiểu)

```bash
(crontab -l 2>/dev/null | grep -v verify-edge-stack
 echo '*/5 * * * * /var/www/Thu-do-online/deploy/verify-edge-stack.sh >> /root/logs/edge-stack-verify.log 2>&1') | crontab -
```

---

## 8. Reboot VPS (cực đoan)

```bash
pm2 save
sudo reboot
```

Sau ~2 phút:

```bash
pm2 status
sudo systemctl status nginx --no-pager
bash /root/check-all-sites.sh
```

---

## 9. Xem log khi vẫn lỗi

```bash
sudo tail -50 /var/log/nginx/error.log
journalctl -u nginx -n 30 --no-pager

pm2 logs thu-do-online --err --lines 50 --nostream
pm2 logs 188-api --err --lines 50 --nostream
pm2 logs 188-web --err --lines 50 --nostream

sudo ss -tlnp | grep -E ':80|:443|:3000|:3001|:8001'
```

---

## 10. Bảng PM2 & port (tham chiếu)

| PM2 | Site | Port / ghi chú |
|-----|------|----------------|
| `thu-do-online` | nanoai.vn | `:3000` → Nginx |
| `worksheet-worker` | nanoai (nền) | Không HTTP public |
| `188-web` | 188.com.vn | `:3001` |
| `188-api` | 188.com.vn | `:8001`, `/health` |

---

## 11. Phòng ngừa

1. Không để `*.save`, `*.bak`, `*.tmp` trong `/etc/nginx/sites-enabled/`.
2. Luôn `sudo nginx -t` trước `reload` / `restart` Nginx.
3. Sau deploy Thu-do-online: `bash deploy/verify-edge-stack.sh` hoặc `update-vps.sh main`.
4. Không ghi đè `.env.local` production (xem `DEPLOY_VPS.md`).
5. Deploy / fix script **đúng repo**: Thu-do-online ↔ `/var/www/Thu-do-online`, 188 ↔ `/var/www/188.com.vn`.

---

## 12. File liên quan

| Repo / path | File |
|-------------|------|
| Thu-do-online | `deploy/verify-edge-stack.sh`, `deploy/update-vps.sh`, `deploy/nginx-nanoai.conf` |
| Thu-do-online | `DEPLOY_VPS.md` |
| 188.com.vn (VPS) | `deploy/fix-web-health.sh`, `deploy/fix-api-health.sh`, `deploy/update-vps.sh` |
| VPS | `/root/check-all-sites.sh` (tự tạo theo §7) |

---

## 13. Cập nhật doc/script Thu-do-online trên VPS

```bash
cd /var/www/Thu-do-online
git fetch origin main
git reset --hard origin/main
chmod +x deploy/verify-edge-stack.sh
bash deploy/verify-edge-stack.sh
```
