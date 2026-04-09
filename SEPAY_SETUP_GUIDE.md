# Hướng dẫn cấu hình SePay cho Thu Do Online

## Thông tin tài khoản SePay của bạn

### Môi trường Test:
- **MERCHANT ID**: `SP-TEST-HPB22294`
- **SECRET KEY**: `spsk_test_PsFHuXN6QBkKNA1srj3bJDZhQaHECJvN`
- **Dashboard**: https://sepay.vn

### Môi trường Production (sau khi test xong):
- Bạn sẽ nhận MERCHANT ID và SECRET KEY mới
- Cần chuyển từ test sang production trong SePay Dashboard

## Các bước cấu hình

### 1. Cấu hình IPN Webhook trong SePay Dashboard

1. Đăng nhập vào **SePay Dashboard**
2. Vào **Tích hợp & Thông báo** → **Tích hợp WebHooks**
3. Tại phần **"Cấu hình IPN nhận thông báo"**, nhập URL:

**Cho development (local):**
```
http://localhost:3000/api/sepay-webhook
```

**Cho production:**
```
https://your-domain.com/api/sepay-webhook
```

4. **Lưu cấu hình**

### 2. Cập nhật thông tin ngân hàng trong database

1. Mở bảng **`payment_configs`** (Table editor hoặc `SELECT` / `UPDATE` qua SQL).
2. Cập nhật thông tin ngân hàng thực tế:

| Field | Giá trị mẫu | Cập nhật thành |
|-------|------------|----------------|
| `bank_account` | `0123456789` | Số TK thực tế của bạn |
| `bank_id` | `MB` | Mã ngân hàng của bạn |
| `bank_name` | `MB Bank` | Tên ngân hàng đầy đủ |
| `is_active` | `true` | Giữ nguyên |

### 3. Cấu hình biến môi trường

Biến môi trường đã được thêm vào `.env.local`:

```env
# SePay Configuration (Test Environment)
SEPAY_MERCHANT_ID=SP-TEST-HPB22294
SEPAY_SECRET_KEY=spsk_test_PsFHuXN6QBkKNA1srj3bJDZhQaHECJvN
SEPAY_API_URL=https://api.sepay.vn
```

### 4. Khởi động ứng dụng

```bash
npm run dev
```

Ứng dụng sẽ chạy tại: `http://localhost:3000`

## Test hệ thống thanh toán

### Test 1: Kiểm tra webhook endpoint
Mở trình duyệt truy cập:
```
http://localhost:3000/api/sepay-webhook
```

Kết quả mong đợi:
```json
{
  "message": "SePay Webhook endpoint is running",
  "instructions": "Send POST request with SePay webhook data"
}
```

### Test 2: Tạo mã QR thanh toán
1. Đăng nhập vào ứng dụng
2. Vào **Dashboard** → **Nạp tiền** (`/dashboard/deposit`)
3. Chọn số tiền (ví dụ: 6,000₫)
4. Chọn ngân hàng
5. Bấm **"Tạo mã QR thanh toán"**
6. Kiểm tra mã QR hiển thị đúng

### Test 3: Test webhook với dữ liệu mẫu

Sử dụng curl để test webhook:

```bash
# Test với dữ liệu JSON mẫu
curl -X POST http://localhost:3000/api/sepay-webhook \
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

### Test 4: Test toàn bộ luồng (cần chuyển khoản thật)

1. **Tạo mã QR** với 6,000₫
2. **Quét mã QR** bằng app ngân hàng
3. **Chuyển khoản** với đúng nội dung `NAP{user_id_8_chars}`
4. **Chờ 1-5 phút** để SePay gửi webhook
5. **Kiểm tra console** để xem webhook nhận được
6. **Kiểm tra credits** được cộng tự động
7. **Kiểm tra lịch sử** tại `/dashboard/transactions`

## Xử lý sự cố

### 1. Webhook không nhận được
- **Kiểm tra URL**: Đảm bảo URL đúng `http://localhost:3000/api/sepay-webhook`
- **Kiểm tra firewall**: Tắt firewall tạm thời để test
- **Dùng ngrok** để public localhost:
  ```bash
  ngrok http 3000
  ```
  Sau đó cấu hình webhook URL thành `https://your-ngrok-url.ngrok.io/api/sepay-webhook`

### 2. Credits không được cộng
- **Kiểm tra console log**: Xem webhook có nhận được không
- **Kiểm tra nội dung**: Đảm bảo nội dung chuyển khoản đúng `NAP{user_id_8_chars}`
- **Kiểm tra database**: Xem bảng `payments` có giao dịch mới không

### 3. Mã QR không hiển thị
- **Kiểm tra thông tin ngân hàng**: Đảm bảo `payment_configs` có dữ liệu
- **Kiểm tra console error**: Mở DevTools (F12) xem có lỗi gì không
- **Kiểm tra network**: Xem request tạo payment có thành công không

## Chuyển sang môi trường Production

### Khi đã test xong:
1. **Liên hệ SePay** để chuyển sang production
2. **Nhận thông tin mới**: MERCHANT ID và SECRET KEY production
3. **Cập nhật biến môi trường**:
   ```env
   SEPAY_MERCHANT_ID=SP-PROD-XXXXXXX
   SEPAY_SECRET_KEY=spsk_prod_xxxxxxxxxxxxxxxx
   ```
4. **Cập nhật webhook URL** trong SePay Dashboard thành production URL
5. **Cập nhật thông tin ngân hàng** thực tế trong `payment_configs`

## Bảo mật

### 1. Bảo vệ Secret Key
- **Không commit** `.env.local` lên git
- **Không chia sẻ** Secret Key với ai
- **Sử dụng biến môi trường** trên server production

### 2. Xác thực webhook
- API đã có sẵn logic xác thực signature (cần implement chi tiết)
- Luôn verify signature trước khi xử lý giao dịch

### 3. Row Level Security (RLS)
Đảm bảo RLS được bật cho các bảng:
- `payments`: Người dùng chỉ xem được giao dịch của mình
- `credits`: Người dùng chỉ xem được số dư của mình
- `payment_configs`: Có thể public (chỉ đọc)

## Hỗ trợ

### SePay Support:
- **Hotline**: 02873.059.589
- **Email**: support@sepay.vn
- **Documentation**: https://docs.sepay.vn

### Thu Do Online:
- Kiểm tra logs trong console
- Kiểm tra database trực tiếp (SQL client / Table editor)
- Test với số tiền nhỏ trước

## Kết quả mong đợi

Sau khi cấu hình thành công:
- ✅ Mã QR thanh toán hiển thị đúng
- ✅ Webhook nhận được callback từ SePay
- ✅ Credits được cộng tự động
- ✅ Lịch sử giao dịch được lưu đầy đủ
- ✅ Người dùng có thể nạp tiền và sử dụng dịch vụ

**Hệ thống thanh toán đã sẵn sàng hoạt động!** 🚀