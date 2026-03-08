# Hướng dẫn Deploy Thu-do-online lên VPS Vietnix

---

## Test local & Deploy không ảnh hưởng production

### Test trên local (máy bạn)

```powershell
cd g:\python-code\Thu-do-online
npm install
npm run dev
```

Mở **http://localhost:3000**. File `.env.local` trên máy bạn dùng `NEXT_PUBLIC_BASE_URL=http://localhost:3000` → tự bypass đăng nhập, test thoải mái.

### Supabase – thêm Redirect URL cho local

Để **đăng nhập Google** hoạt động trên local, cần thêm URL trong Supabase:

1. Vào **Supabase Dashboard** → **Authentication** → **URL Configuration**
2. Trong **Redirect URLs**, thêm:
   ```
   http://localhost:3000/auth/callback
   ```
3. Lưu. (Production `https://nanoai.vn/auth/callback` nên đã có sẵn.)

### .env.local – checklist cho local

| Biến | Cần có | Ghi chú |
|------|--------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✓ | Từ Supabase Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✓ | Từ Supabase Settings → API |
| `NEXT_PUBLIC_BASE_URL` | ✓ | `http://localhost:3000` cho local |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ | Cho admin, history, credits |
| `GOOGLE_API_KEY` | ✓ | Từ Google AI Studio |
| `VISION_CREDENTIALS_PATH` | ✓ | Đường dẫn file GCP credentials (thử đồ, hoán đổi mặt) |
| `AUTH_DEV_USER_ID` | ✓ | UUID user test khi bypass đăng nhập |
| `NEXT_PUBLIC_AUTH_DEV_USER_ID` | ✓ | Cùng UUID, dùng cho client |
| SePay (nếu test nạp tiền) | Tùy chọn | MERCHANT_ID, SECRET_KEY... |
| `APP_URL` | Tùy chọn | Có thể dùng `http://localhost:3000` thay cho BASE_URL |

### Deploy lên VPS – không ghi đè .env production

**Quan trọng:** `.env.local` trên VPS có cấu hình production (nanoai.vn). Khi deploy từ local, **không được copy/ghi đè** file này.

| Cách deploy | Cách tránh ghi đè .env |
|-------------|------------------------|
| **Git** | `.env.local` đã nằm trong `.gitignore` → không bị push. Trên VPS giữ nguyên `.env.local` cũ. |
| **SCP** | `scp -r` sẽ copy cả `.env.local` local (localhost) lên VPS → **sai**. Dùng rsync có exclude. |
| **rsync** | Thêm `--exclude .env.local` để không gửi file này lên VPS. |

**Rsync (khuyến nghị khi upload từ local):**
```powershell
rsync -avz --exclude node_modules --exclude .next --exclude .env.local --exclude ".env*.local" g:\python-code\Thu-do-online\ root@14.225.218.39:/var/www/Thu-do-online/
```

**Nếu dùng SCP:** Trước khi `scp`, tạm đổi tên `.env.local` → `.env.local.backup`, deploy xong đổi lại. Hoặc trên VPS backup `.env.local` rồi sau deploy chép lại.

### Quy trình đề xuất

1. **Dev local** → sửa code, test `npm run dev`
2. **Commit & push** (nếu dùng Git) hoặc **rsync** lên VPS
3. **Trên VPS:** `git pull` (hoặc code đã rsync) → `npm install` → `npm run build` → `pm2 restart thu-do-online`
4. File `.env.local` trên VPS **không đổi** → production chạy bình thường

---

## Bước 1: Lấy thông tin VPS từ Vietnix

1. Đăng nhập [portal.vietnix.vn](https://portal.vietnix.vn)
2. Vào **Dịch vụ** → **Cloud VPS** → chọn VPS vừa mua
3. Ghi lại:
   - **IP Address** (ví dụ: `123.45.67.89`)
   - **Username** (thường là `root`)
   - **Password** (gửi qua email hoặc trong panel)

---

## Bước 2: SSH vào VPS

**Trên Windows (PowerShell hoặc CMD):**
```powershell
ssh root@IP_CUA_BAN
# Ví dụ: ssh root@123.45.67.89
```

Nhập password khi được hỏi.

---

## Bước 3: Cài đặt môi trường trên VPS

Chạy lần lượt các lệnh sau:

```bash
# Cập nhật hệ thống
sudo apt update && sudo apt upgrade -y

# Cài build tools (cho sharp, canvas, opencv4nodejs)
sudo apt install -y build-essential python3 python3-pip git

# Cài rembg + Pillow cho tách nền (Tạo nhãn dán, Xóa nền PNG). Xem scripts/REMBG_README.md nếu lỗi.
sudo pip3 install "rembg[cpu,cli]"
sudo pip3 install pillow

# Cài Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Kiểm tra
node -v   # phải >= 18
npm -v

# Cài PM2 (chạy app 24/7, tự restart khi crash)
sudo npm install -g pm2
```

---

## Bước 4: Deploy code lên VPS

### Cách A: Dùng Git (khuyến nghị)

Nếu code đã đẩy lên GitHub/GitLab:

```bash
cd /var
sudo mkdir -p www
sudo chown $USER:$USER www
cd www

# Clone repo (thay YOUR_REPO bằng URL thật)
git clone https://github.com/YOUR_USERNAME/Thu-do-online.git
cd Thu-do-online
```

### Cách B: Upload từ máy local

Trên máy Windows (PowerShell), dùng SCP:

```powershell
scp -r g:\python-code\Thu-do-online root@IP_CUA_BAN:/var/www/
```

Sau đó SSH vào VPS và `cd /var/www/Thu-do-online`.

---

## Bước 5: Cấu hình .env

Trên VPS:

```bash
cd /var/www/Thu-do-online

# Tạo file .env.local (hoặc .env.production)
nano .env.local
```

Dán nội dung từ `.env.local` trên máy bạn, **chỉnh sửa**:

```
# Đổi localhost thành domain/IP thật
NEXT_PUBLIC_BASE_URL=https://your-domain.com
# hoặc tạm thời: http://IP_CUA_BAN:3000

# Bỏ AUTH_DEV_USER_ID nếu không cần bypass (production)
# AUTH_DEV_USER_ID=...
```

Lưu: `Ctrl+O` → Enter → `Ctrl+X`

---

## Bước 6: Cài dependency và Build

```bash
cd /var/www/Thu-do-online

# Cài dependencies
npm install

# Build (có thể mất 5–10 phút, cần ~4GB RAM)
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

Nếu build báo lỗi thiếu RAM, chạy:
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```
Rồi chạy lại `npm run build`.

### SWAP 4GB (tùy chọn)

Tạo nhãn dán dùng sharp chuyển nền trắng → trong suốt, nhẹ hơn AI tách nền. SWAP 4GB chỉ cần nếu chạy nhiều tính năng nặng đồng thời.

---

## Bước 7: Chạy app với PM2

```bash
cd /var/www/Thu-do-online

# Chạy
pm2 start npm --name "thu-do-online" -- start

# Tự chạy khi reboot
pm2 startup
pm2 save

# Xem log
pm2 logs thu-do-online
```

App chạy tại: `http://IP_CUA_BAN:3000`

---

## Bước 8 (Tùy chọn): Nginx + SSL

Để dùng domain và HTTPS:

```bash
# Cài Nginx
sudo apt install -y nginx certbot python3-certbot-nginx

# Tạo config (thay your-domain.com và IP)
sudo nano /etc/nginx/sites-available/thu-do-online
```

Nội dung:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/thu-do-online /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# SSL miễn phí (Let's Encrypt)
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

---

## Cập nhật code sau này

### Cách 1: Dùng Git (nếu đã clone từ GitHub)

**Trên máy local** – commit và push:
```powershell
cd g:\python-code\Thu-do-online
git add .
git commit -m "Cập nhật"
git push
```

**Trên VPS** – pull và build:
```bash
cd /var/www/Thu-do-online
git pull
npm install
NODE_OPTIONS="--max-old-space-size=4096" npm run build
pm2 restart thu-do-online
```

**Hoặc dùng script có sẵn (khuyến nghị):**
```bash
cd /var/www/Thu-do-online
bash deploy/update-vps.sh main
```

### Cách 2: Upload bằng rsync (không dùng Git)

**Trên máy local (PowerShell)** – cần cài rsync (qua Git Bash, WSL, hoặc cài riêng):
```powershell
rsync -avz --exclude node_modules --exclude .next --exclude .env.local --exclude ".env*.local" g:\python-code\Thu-do-online\ root@14.225.218.39:/var/www/Thu-do-online/
```
*Bỏ qua `node_modules`, `.next`, `.env.local` → không ghi đè cấu hình production trên VPS.*

**Nếu dùng SCP** (không khuyến nghị – sẽ copy cả .env local lên VPS):
```powershell
scp -r g:\python-code\Thu-do-online root@14.225.218.39:/var/www/
```
Sau đó SSH vào VPS và **khôi phục** `.env.local` production nếu bị ghi đè.

**Trên VPS** – build và restart:
```bash
cd /var/www/Thu-do-online
npm install
NODE_OPTIONS="--max-old-space-size=4096" npm run build
pm2 restart thu-do-online
```

### Cập nhật Nginx (chỉ lần đầu hoặc khi đổi config)

Sau khi có file `deploy/nginx-nanoai.conf` trên VPS:
```bash
sudo cp /var/www/Thu-do-online/deploy/nginx-nanoai.conf /etc/nginx/sites-available/nanoai
sudo ln -sf /etc/nginx/sites-available/nanoai /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

---

## Lệnh PM2 hữu ích

| Lệnh | Mô tả |
|------|-------|
| `pm2 status` | Xem trạng thái |
| `pm2 logs thu-do-online` | Xem log |
| `pm2 restart thu-do-online` | Khởi động lại |
| `pm2 stop thu-do-online` | Dừng |
| `pm2 delete thu-do-online` | Xóa khỏi PM2 |

### Chạy PM2 bằng ecosystem config (tùy chọn)

```bash
cd /var/www/Thu-do-online
pm2 start ecosystem.config.cjs
pm2 save
```

---

## Kiểm tra VPS & xử lý "chạy mãi không xong"

### 1. Kiểm tra nhanh VPS có chạy không

**Từ máy local (PowerShell):**
```powershell
# Kiểm tra trang web phản hồi
curl -I https://nanoai.vn

# Hoặc ping IP
ping 14.225.218.39
```

**Trên VPS (SSH):**
```bash
# Trạng thái PM2
pm2 status

# Log gần đây (Ctrl+C để thoát)
pm2 logs thu-do-online --lines 50

# CPU, RAM
htop
# hoặc: free -h && uptime
```

### 2. Nguyên nhân "gửi lệnh chạy mãi không xong"

API Google Gemini (tạo ảnh, thử đồ...) có thể mất **2–5 phút**. Nginx mặc định cắt kết nối sau **60 giây** → request bị ngắt giữa chừng.

### 3. Sửa: tăng timeout Nginx (5 phút)

Có sẵn file mẫu `deploy/nginx-nanoai.conf` – copy lên VPS rồi chỉnh `server_name`:

```bash
# Trên VPS
sudo cp /var/www/Thu-do-online/deploy/nginx-nanoai.conf /etc/nginx/sites-available/nanoai
# Sửa server_name trong file nếu dùng domain khác nanoai.vn
sudo ln -sf /etc/nginx/sites-available/nanoai /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

**Nếu đã có Nginx + SSL:** Chỉ cần thêm vào trong `location /`:

```nginx
    # Timeout 5 phút cho API AI
    proxy_connect_timeout 300;
    proxy_send_timeout 300;
    proxy_read_timeout 300;

    # Buffer cho request lớn (upload ảnh)
    client_max_body_size 50M;
    proxy_buffer_size 128k;
    proxy_buffers 4 256k;
    proxy_busy_buffers_size 256k;
    proxy_temp_file_write_size 256k;
```

Áp dụng:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 4. Nếu vẫn treo – xem log

```bash
# Log PM2 (lỗi từ app)
pm2 logs thu-do-online --err --lines 100

# Log Nginx
sudo tail -100 /var/log/nginx/error.log
```
