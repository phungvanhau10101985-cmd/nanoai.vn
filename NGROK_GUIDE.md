# Hướng dẫn sử dụng ngrok để test SePay Webhook

## Tại sao cần ngrok?

Khi test webhook SePay, SePay cần gửi HTTP request đến server của bạn. Tuy nhiên, server localhost (`http://localhost:3000`) không thể truy cập từ internet. **Ngrok** tạo public URL trỏ đến localhost của bạn, cho phép SePay gửi webhook đến server local.

## Các bước cài đặt và sử dụng ngrok

### Bước 1: Đăng ký tài khoản ngrok
1. Truy cập: https://dashboard.ngrok.com/signup
2. Đăng ký tài khoản miễn phí
3. Xác nhận email

### Bước 2: Lấy Authtoken
1. Đăng nhập vào: https://dashboard.ngrok.com
2. Vào **Your Authtoken**: https://dashboard.ngrok.com/get-started/your-authtoken
3. Copy authtoken của bạn (dạng: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)

### Bước 3: Tải và cài đặt ngrok
1. Tải ngrok từ: https://ngrok.com/download
2. Chọn **Windows**
3. Giải nén file `ngrok.exe`
4. Đặt `ngrok.exe` vào một trong các vị trí:
   - `C:\Windows\System32` (khuyến nghị)
   - Hoặc thư mục bất kỳ và thêm vào PATH

### Bước 4: Cấu hình authtoken
Mở Command Prompt/PowerShell với quyền Administrator và chạy:
```bash
ngrok config add-authtoken YOUR_AUTH_TOKEN
```
Thay `YOUR_AUTH_TOKEN` bằng token bạn đã copy ở bước 2.

### Bước 5: Chạy ngrok
Đảm bảo server đang chạy (`npm run dev`), sau đó chạy:
```bash
ngrok http 3000
```

Kết quả sẽ hiển thị:
```
ngrok                                                                 (Ctrl+C to quit)

Session Status                online
Account                       Your Name (Plan: Free)
Version                       3.8.0
Region                        United States (us)
Latency                       45ms
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://abc123.ngrok.io -> http://localhost:3000
```

**Lưu ý**: URL `https://abc123.ngrok.io` sẽ thay đổi mỗi lần chạy.

## Cấu hình SePay Webhook với ngrok

### Bước 1: Lấy ngrok URL
Sau khi chạy `ngrok http 3000`, copy URL `Forwarding` (ví dụ: `https://abc123.ngrok.io`)

### Bước 2: Cấu hình trong SePay Dashboard
1. Đăng nhập vào **SePay Dashboard**
2. Vào **Tích hợp & Thông báo** → **Tích hợp WebHooks**
3. Tại phần **"Cấu hình IPN nhận thông báo"**, nhập URL:
   ```
   https://abc123.ngrok.io/api/sepay-webhook
   ```
   (Thay `abc123` bằng URL thực tế của bạn)
4. **Lưu cấu hình**

### Bước 3: Test webhook
1. Tạo giao dịch thanh toán thử
2. SePay sẽ gửi webhook đến `https://abc123.ngrok.io/api/sepay-webhook`
3. Ngrok sẽ forward request đến `http://localhost:3000/api/sepay-webhook`
4. Server của bạn xử lý và cộng credits

## Script tự động hóa

### Script 1: `setup-ngrok.bat`
```batch
@echo off
echo ============================================
echo  Cài đặt và chạy ngrok cho Thu Do Online
echo ============================================
echo.

echo [1] Kiểm tra ngrok đã cài đặt chưa...
where ngrok >nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ Ngrok đã được cài đặt
    goto :RUN_NGROK
) else (
    echo ✗ Ngrok chưa được cài đặt
    echo.
    echo [2] Tải ngrok từ trang chủ...
    echo Lưu ý: Bạn cần tải ngrok thủ công từ:
    echo https://ngrok.com/download
    echo.
    echo Sau khi tải về, giải nén và đặt file ngrok.exe vào:
    echo C:\Windows\System32
    echo hoặc thêm vào PATH
    echo.
    pause
    exit /b 1
)

:RUN_NGROK
echo.
echo [3] Kiểm tra server đang chạy trên port 3000...
netstat -an | findstr :3000 >nul
if %errorlevel% equ 0 (
    echo ✓ Server đang chạy trên port 3000
) else (
    echo ✗ Server không chạy trên port 3000
    echo Hãy chạy: npm run dev
    pause
    exit /b 1
)

echo.
echo [4] Chạy ngrok tunnel cho localhost:3000...
echo Lưu ý: Bạn cần có tài khoản ngrok và authtoken
echo.
echo Nếu chưa có tài khoản:
echo 1. Đăng ký tại: https://dashboard.ngrok.com/signup
echo 2. Lấy authtoken từ: https://dashboard.ngrok.com/get-started/your-authtoken
echo 3. Chạy lệnh: ngrok config add-authtoken YOUR_AUTH_TOKEN
echo.
echo [5] Chạy ngrok...
echo Đang mở tunnel từ ngrok đến localhost:3000...
echo.
ngrok http 3000

pause
```

### Script 2: `start-ngrok-with-auth.bat` (nếu đã có authtoken)
```batch
@echo off
echo ============================================
echo  Chạy ngrok với authtoken đã cấu hình
echo ============================================
echo.

echo [1] Kiểm tra server...
netstat -an | findstr :3000 >nul
if %errorlevel% neq 0 (
    echo ✗ Server không chạy trên port 3000
    echo Hãy chạy: npm run dev
    pause
    exit /b 1
)

echo ✓ Server đang chạy trên port 3000
echo.
echo [2] Chạy ngrok...
echo Đang mở tunnel đến localhost:3000...
echo Public URL sẽ hiển thị bên dưới...
echo.
ngrok http 3000

pause
```

## Test ngrok hoạt động

### Test 1: Kiểm tra ngrok tunnel
1. Chạy `ngrok http 3000`
2. Mở trình duyệt truy cập: `https://abc123.ngrok.io`
3. Nếu thấy trang web của bạn, ngrok đang hoạt động

### Test 2: Kiểm tra webhook endpoint
1. Truy cập: `https://abc123.ngrok.io/api/sepay-webhook`
2. Kết quả mong đợi:
```json
{
  "message": "SePay Webhook endpoint is running",
  "instructions": "Send POST request with SePay webhook data"
}
```

### Test 3: Test webhook với curl
```bash
curl -X POST https://abc123.ngrok.io/api/sepay-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 6000,
    "description": "NAPabc123de",
    "transaction_id": "sepay_test_123",
    "status": "success",
    "bank_account": "0123456789",
    "bank_name": "MB Bank"
  }'
```

## Xử lý sự cố

### 1. Lỗi "ngrok: command not found"
- Đảm bảo `ngrok.exe` trong `C:\Windows\System32`
- Hoặc thêm thư mục chứa `ngrok.exe` vào PATH

### 2. Lỗi "Your account is limited to 1 simultaneous ngrok client session"
- Chỉ được chạy 1 session ngrok cùng lúc (bản free)
- Kiểm tra task manager, tắt các session ngrok cũ

### 3. Lỗi "Tunnel session failed: unauthorized"
- Authtoken không đúng hoặc chưa cấu hình
- Chạy lại: `ngrok config add-authtoken YOUR_AUTH_TOKEN`

### 4. Webhook không nhận được
- Kiểm tra ngrok đang chạy
- Kiểm tra URL trong SePay Dashboard đúng `https://abc123.ngrok.io/api/sepay-webhook`
- Kiểm tra firewall/antivirus không chặn ngrok

### 5. URL ngrok thay đổi
- Mỗi lần chạy `ngrok http 3000` sẽ có URL khác nhau
- Cần cập nhật lại URL trong SePay Dashboard
- Bản trả phí có thể giữ URL cố định

## Lưu ý quan trọng

### 1. Bảo mật
- **Không chia sẻ** ngrok URL công khai
- **Chỉ dùng để test**, không dùng cho production
- **Tắt ngrok** khi không test webhook

### 2. Giới hạn bản free
- **1 session** cùng lúc
- **URL thay đổi** mỗi lần chạy
- **Bandwidth giới hạn**
- **Không có custom domain**

### 3. Production
Khi deploy lên server thật:
- **Không cần ngrok**
- Dùng domain thật: `https://your-domain.com/api/sepay-webhook`
- Cấu hình SSL/TLS
- Cấu hình firewall properly

## Kết luận

Ngrok là công cụ **cần thiết** để test webhook SePay trong quá trình development. Sau khi test xong trên local với ngrok, bạn có thể tự tin deploy lên production với domain thật.

**Lưu ý cuối**: Luôn test với số tiền nhỏ trước khi test với số tiền lớn!