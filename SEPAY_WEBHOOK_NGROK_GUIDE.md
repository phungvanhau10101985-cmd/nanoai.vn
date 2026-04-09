# Hướng dẫn cấu hình SePay Webhook với ngrok

## Quy trình hoàn chỉnh

### Bước 1: Chuẩn bị môi trường
1. **Server đang chạy**: `npm run dev` (localhost:3000)
2. **Ngrok đã cài đặt**: `ngrok.exe` trong `C:\Windows\System32`
3. **Ngrok authtoken**: Đã cấu hình với `ngrok config add-authtoken YOUR_TOKEN`

### Bước 2: Chạy ngrok
1. Mở Command Prompt/PowerShell
2. Chạy: `ngrok http 3000`
3. Copy **Forwarding URL** (ví dụ: `https://abc123.ngrok.io`)

### Bước 3: Cấu hình SePay Dashboard
1. Đăng nhập **SePay Dashboard**: https://sepay.vn
2. Vào **Tích hợp & Thông báo** → **Tích hợp WebHooks**
3. Tại **"Cấu hình IPN nhận thông báo"**, nhập:
   ```
   https://abc123.ngrok.io/api/sepay-webhook
   ```
   (Thay `abc123` bằng URL thực tế của bạn)
4. **Lưu cấu hình**

### Bước 4: Test webhook
1. **Tạo mã QR thanh toán** trong ứng dụng
2. **Chuyển khoản** với nội dung đúng `NAP{user_id_8_chars}`
3. **Chờ 1-5 phút** SePay gửi webhook
4. **Kiểm tra console** xem webhook nhận được
5. **Kiểm tra credits** được cộng tự động

## Chi tiết từng bước

### 1. Lấy ngrok URL
Sau khi chạy `ngrok http 3000`, bạn sẽ thấy:
```
Forwarding                    https://abc123.ngrok.io -> http://localhost:3000
```

**URL webhook** của bạn sẽ là: `https://abc123.ngrok.io/api/sepay-webhook`

### 2. Cấu hình trong SePay Dashboard

#### Ảnh minh họa cấu hình:
```
SePay Dashboard > Tích hợp & Thông báo > Tích hợp WebHooks

┌─────────────────────────────────────────────────────┐
│                Cấu hình IPN nhận thông báo           │
├─────────────────────────────────────────────────────┤
│ URL nhận thông báo:                                 │
│ https://abc123.ngrok.io/api/sepay-webhook           │
│                                                     │
│ [X] Bật IPN                                         │
│                                                     │
│                    [Lưu cấu hình]                   │
└─────────────────────────────────────────────────────┘
```

### 3. Test nhanh với curl
```bash
# Test webhook endpoint
curl https://abc123.ngrok.io/api/sepay-webhook

# Test với dữ liệu mẫu
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

### 4. Kiểm tra kết quả

#### Console log khi webhook nhận được:
```
[SePay Webhook] Received callback
[SePay Webhook] Transaction ID: sepays_test_123
[SePay Webhook] Amount: 6000 VND
[SePay Webhook] Description: NAPabc123de
[SePay Webhook] Processing payment...
[SePay Webhook] Credits added: 1
[SePay Webhook] Payment completed successfully
```

#### Database sau khi xử lý:
- Bảng `payments`: Thêm giao dịch mới với status `completed`
- Bảng `credits`: Cộng thêm 1 credit cho user
- Bảng `transactions`: Hiển thị trong lịch sử

## Script tự động hóa

### Script chạy ngrok: `run-ngrok-for-sepay.bat`
```batch
@echo off
title Ngrok for SePay Webhook - Thu Do Online
color 0A

echo ================================================
echo    SE PAY WEBHOOK TEST WITH NGROK
echo ================================================
echo.

echo [1] Checking prerequisites...
echo.

:: Check if server is running
echo - Checking server on port 3000...
netstat -an | findstr :3000 >nul
if %errorlevel% equ 0 (
    echo   ✓ Server is running on port 3000
) else (
    echo   ✗ Server is NOT running on port 3000
    echo   Please run: npm run dev
    echo.
    pause
    exit /b 1
)

:: Check if ngrok is installed
echo - Checking ngrok installation...
where ngrok >nul 2>&1
if %errorlevel% equ 0 (
    echo   ✓ Ngrok is installed
) else (
    echo   ✗ Ngrok is NOT installed
    echo   Download from: https://ngrok.com/download
    echo   Extract ngrok.exe to C:\Windows\System32
    echo.
    pause
    exit /b 1
)

echo.
echo [2] Important Information:
echo.
echo BEFORE PROCEEDING:
echo 1. Make sure you have ngrok account (free)
echo 2. Configure authtoken: ngrok config add-authtoken YOUR_TOKEN
echo.
echo AFTER NGROK STARTS:
echo 1. Copy the Forwarding URL (e.g., https://abc123.ngrok.io)
echo 2. Configure in SePay Dashboard:
echo    URL: https://abc123.ngrok.io/api/sepay-webhook
echo.
echo [3] Starting ngrok...
echo ================================================
echo.

ngrok http 3000

echo.
echo ================================================
echo    Ngrok session ended
echo ================================================
pause
```

### Script test webhook: `test-sepay-webhook.bat`
```batch
@echo off
title Test SePay Webhook
color 0B

echo ================================================
echo    TEST SE PAY WEBHOOK
echo ================================================
echo.

set /p NGROK_URL=Enter your ngrok URL (e.g., https://abc123.ngrok.io): 

echo.
echo [1] Testing webhook endpoint...
curl %NGROK_URL%/api/sepay-webhook

echo.
echo [2] Testing with sample data...
curl -X POST %NGROK_URL%/api/sepay-webhook ^
  -H "Content-Type: application/json" ^
  -d "{ \"amount\": 6000, \"description\": \"NAPtest1234\", \"transaction_id\": \"sepay_test_%RANDOM%\", \"status\": \"success\", \"bank_account\": \"0123456789\", \"bank_name\": \"MB Bank\" }"

echo.
echo ================================================
echo    Test completed
echo ================================================
echo.
echo Next steps:
echo 1. Check console for webhook logs
echo 2. Check database for new payment record
echo 3. Check user credits updated
echo.
pause
```

## Xử lý sự cố thường gặp

### 1. Webhook không nhận được
**Triệu chứng**: Chuyển khoản thành công nhưng không thấy credits cộng

**Kiểm tra**:
```bash
# 1. Kiểm tra ngrok đang chạy
# 2. Kiểm tra URL trong SePay Dashboard đúng
# 3. Kiểm tra console log
# 4. Test với curl
curl -X POST https://abc123.ngrok.io/api/sepay-webhook \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

**Giải pháp**:
- Đảm bảo ngrok đang chạy
- Cập nhật URL trong SePay Dashboard
- Kiểm tra firewall/antivirus

### 2. Lỗi "Invalid signature"
**Triệu chứng**: Webhook nhận được nhưng báo lỗi signature

**Nguyên nhân**: SePay gửi kèm signature, cần verify

**Giải pháp**: 
- Implement signature verification trong `api/sepay-webhook/route.ts`
- Sử dụng `SEPAY_SECRET_KEY` từ `.env.local`

### 3. Credits không cộng
**Triệu chứng**: Webhook nhận được, payment lưu database, nhưng credits không tăng

**Kiểm tra**:
```sql
-- Kiểm tra trong Postgres
SELECT * FROM payments ORDER BY created_at DESC LIMIT 5;
SELECT * FROM credits WHERE user_id = 'user_id_here';
```

**Giải pháp**:
- Kiểm tra logic cộng credits trong webhook handler
- Kiểm tra user_id extraction từ transaction content

### 4. Ngrok URL thay đổi
**Triệu chứng**: Mỗi lần chạy ngrok có URL khác nhau

**Giải pháp**:
1. **Bản free**: Cập nhật lại URL trong SePay Dashboard mỗi lần chạy
2. **Bản trả phí**: Dùng custom domain/subdomain cố định

## Best Practices

### 1. Test với số tiền nhỏ
- Luôn test với 6,000 VND (1 credit) trước
- Không test với số tiền lớn ngay

### 2. Log đầy đủ
- Log mọi webhook request nhận được
- Log kết quả xử lý
- Log lỗi nếu có

### 3. Xác thực dữ liệu
- Verify signature từ SePay
- Validate transaction data
- Check duplicate transactions

### 4. Xử lý lỗi
- Retry logic cho webhook failed
- Manual review process
- Alert system cho lỗi nghiêm trọng

## Monitoring

### 1. Console monitoring
```typescript
// Trong webhook handler
console.log('[SePay Webhook] Received:', {
  timestamp: new Date().toISOString(),
  transactionId: data.transaction_id,
  amount: data.amount,
  status: data.status
});
```

### 2. Database monitoring
```sql
-- Monitor recent payments
SELECT 
  COUNT(*) as total_payments,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
  SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
  MAX(created_at) as latest_payment
FROM payments
WHERE created_at > NOW() - INTERVAL '1 hour';
```

### 3. Ngrok monitoring
- Truy cập: `http://127.0.0.1:4040` (ngrok web interface)
- Xem request history
- Xem response status

## Kết luận

Ngrok là công cụ **không thể thiếu** để test SePay webhook trong quá trình development. Sau khi test thành công với ngrok, bạn có thể:

1. **Tự tin deploy** lên production
2. **Cấu hình domain thật** trong SePay Dashboard
3. **Monitor production webhook**
4. **Scale hệ thống** khi có nhiều giao dịch

**Lưu ý quan trọng**: Luôn giữ bản backup của code và database trước khi test các thay đổi lớn!