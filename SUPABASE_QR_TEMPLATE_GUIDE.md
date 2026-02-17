# Hướng dẫn kiểm tra QR template trong Supabase

## Cách 1: Dùng Supabase Dashboard (Dễ nhất)

### Bước 1: Đăng nhập Supabase
1. Mở trình duyệt truy cập: **https://supabase.com/dashboard**
2. Đăng nhập với tài khoản của bạn
3. Chọn project **"thu-do-online"**

### Bước 2: Vào Table Editor
```
Menu bên trái → Table Editor
```

### Bước 3: Tìm bảng payment_configs
1. Trong danh sách bảng, tìm **`payment_configs`**
2. Click vào tên bảng để mở

### Bước 4: Xem QR template URL
Bạn sẽ thấy bảng như sau:

```
┌─────────────────────────────────────────────────────────────────────┐
│                     payment_configs TABLE                           │
├─────┬─────────────┬────────┬──────────────┬─────────────────────────┤
│ id  │ bank_name   │ bank_id│ bank_account │ qr_template_url         │
├─────┼─────────────┼────────┼──────────────┼─────────────────────────┤
│ 1   │ VietinBank  │ VTB    │ 107000958284 │ URL SẼ HIỆN Ở ĐÂY      │
└─────┴─────────────┴────────┴──────────────┴─────────────────────────┘
```

**Copy giá trị trong cột `qr_template_url`**

## Cách 2: Dùng SQL Editor (Chính xác)

### Bước 1: Vào SQL Editor
```
Menu bên trái → SQL Editor
```

### Bước 2: Tạo query mới
1. Click **New query**
2. Đặt tên query: "Check QR Template"

### Bước 3: Chạy SQL query
Copy và paste SQL này:

```sql
-- Kiểm tra QR template hiện tại
SELECT 
  id,
  bank_name,
  bank_id,
  bank_account,
  qr_template_url,
  is_active,
  created_at,
  updated_at
FROM payment_configs
WHERE is_active = true;
```

### Bước 4: Run query
Click nút **Run** (màu xanh)

### Bước 5: Xem kết quả
Kết quả sẽ hiển thị ở phần dưới:

```
┌─────┬─────────────┬────────┬──────────────┬────────────────────────────────────────────┬──────────┬─────────────────────┬─────────────────────┐
│ id  │ bank_name   │ bank_id│ bank_account │ qr_template_url                           │ is_active│ created_at          │ updated_at          │
├─────┼─────────────┼────────┼──────────────┼────────────────────────────────────────────┼──────────┼─────────────────────┼─────────────────────┤
│ 1   │ VietinBank  │ VTB    │ 107000958284 │ https://qr.sepay.vn/{bank_id}/{bank_acc}...│ true     │ 2024-01-01 10:00:00 │ 2024-01-01 10:00:00 │
└─────┴─────────────┴────────┴──────────────┴────────────────────────────────────────────┴──────────┴─────────────────────┴─────────────────────┘
```

## QR template format cần kiểm tra

### Format ĐÚNG (cho app ngân hàng):
```
https://qr.sepay.vn/{bank_id}/{bank_acc}/{amount}/{content}
```

**Ví dụ đúng:**
```
https://qr.sepay.vn/VTB/107000958284/6000/NAPabc123de
```

### Format SAI (không hoạt động với app ngân hàng):
```
https://api.sepay.vn/qr?bank_id={bank_id}&bank_acc={bank_acc}&amount={amount}&content={content}
```

```
https://example.com/qr/{bank_id}/{bank_acc} (thiếu amount và content)
```

```
https://qr.sepay.vn/{bank_id}/{bank_acc} (thiếu amount và content)
```

## Sau khi kiểm tra

### Trường hợp 1: QR template ĐÚNG format
1. **Test trong ứng dụng**: Đăng nhập → Nạp tiền → Tạo mã QR
2. **Quét bằng app ngân hàng**: Kiểm tra thông tin tự động điền
3. **Nếu hoạt động**: Hệ thống OK

### Trường hợp 2: QR template SAI format
Cần cập nhật bằng SQL:

#### Bước 1: Tạo query update
Trong SQL Editor, tạo query mới:

```sql
-- Cập nhật QR template đúng format cho SePay
UPDATE payment_configs 
SET 
  qr_template_url = 'https://qr.sepay.vn/{bank_id}/{bank_acc}/{amount}/{content}',
  updated_at = NOW()
WHERE is_active = true;
```

#### Bước 2: Run update query
Click **Run**

#### Bước 3: Kiểm tra lại
Chạy lại query kiểm tra:

```sql
SELECT bank_name, qr_template_url FROM payment_configs WHERE is_active = true;
```

## Test QR template mới

### Bước 1: Restart server (nếu cần)
```bash
npm run dev
```

### Bước 2: Test trong ứng dụng
1. Đăng nhập: `http://localhost:3000`
2. Vào: `http://localhost:3000/dashboard/deposit`
3. Tạo mã QR 6,000 VND

### Bước 3: Kiểm tra QR URL
Mở Developer Tools (F12) → Network tab:
1. Tìm request `POST /api/create-payment`
2. Xem response JSON
3. Tìm `qr_url` trong response

**QR URL đúng sẽ có dạng:**
```
https://qr.sepay.vn/VTB/107000958284/6000/NAPabc123de
```

### Bước 4: Test quét mã QR
1. Mở app ngân hàng (VietinBank, MB Bank, etc.)
2. Quét mã QR từ trang web
3. Kiểm tra thông tin tự động điền:
   - Số tài khoản: `107000958284`
   - Số tiền: `6,000`
   - Nội dung: `NAPabc123de`

## Troubleshooting

### Vấn đề 1: Không thấy bảng payment_configs
**Giải pháp:**
1. Kiểm tra đã chạy migration chưa
2. Chạy SQL tạo bảng:

```sql
CREATE TABLE IF NOT EXISTS payment_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_name TEXT NOT NULL,
  bank_id TEXT NOT NULL,
  bank_account TEXT NOT NULL,
  qr_template_url TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Vấn đề 2: QR template trống
**Giải pháp:** Thêm QR template:

```sql
INSERT INTO payment_configs (bank_name, bank_id, bank_account, qr_template_url, is_active)
VALUES 
  ('VietinBank', 'VTB', '107000958284', 'https://qr.sepay.vn/{bank_id}/{bank_acc}/{amount}/{content}', true),
  ('MB Bank', 'MB', '0123456789', 'https://qr.sepay.vn/{bank_id}/{bank_acc}/{amount}/{content}', true);
```

### Vấn đề 3: App ngân hàng không nhận diện QR
**Kiểm tra:**
1. QR URL có đúng format không
2. Bank ID có đúng không (VTB cho VietinBank, MB cho MB Bank)
3. Mở QR URL trong browser xem có hiển thị hình QR không

### Vấn đề 4: Thông tin không tự điền
**Kiểm tra:**
1. QR có phải Bank QR Code không
2. Test với app ngân hàng khác
3. Kiểm tra content encoding trong code

## Lưu ý quan trọng

1. **QR template phải có 4 placeholder**:
   - `{bank_id}`
   - `{bank_acc}`
   - `{amount}`
   - `{content}`

2. **Bank ID phải đúng**:
   - VietinBank: `VTB` hoặc `970415`
   - MB Bank: `MB` hoặc `970422`
   - Vietcombank: `VCB` hoặc `970436`

3. **Content phải được encode**:
   Trong code: `.replace('{content}', encodeURIComponent(content))`

4. **Test với số tiền nhỏ** (6,000 VND) trước

## Kết luận

Sau khi kiểm tra và cập nhật QR template đúng format, hệ thống sẽ:
1. Tạo mã QR đúng chuẩn ngân hàng
2. Khi quét bằng app ngân hàng, thông tin tự động điền
3. Người dùng chỉ cần xác nhận chuyển khoản
4. SePay gửi webhook, hệ thống tự động cộng credits

**Hãy bắt đầu với Cách 1 (Supabase Dashboard) để kiểm tra QR template hiện tại!**