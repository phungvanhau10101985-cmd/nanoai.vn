# Hướng dẫn chạy SQL Migration cho hệ thống thanh toán

## Bước 1: Kết nối Postgres

Dùng bất kỳ client nào nối được tới database (cùng URI với `DATABASE_URL`): **SQL Editor** trên host, **pgAdmin**, **`psql`**, v.v.

## Bước 2: Mở cửa sổ query

Tạo query mới (hoặc `psql` và dán SQL).

## Bước 3: Chạy SQL migration

Copy toàn bộ SQL dưới đây, paste và chạy (**Run** / Enter tùy client):

*(Khuyến nghị lâu dài: đưa DDL vào file trong `supabase/migrations/` và áp dụng theo quy trình migration của team thay vì chỉ paste tay.)*

```sql
-- Tạo bảng lưu thông tin giao dịch thanh toán
CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- Số tiền nạp (đơn vị: VND)
  credits_added INTEGER NOT NULL, -- Số credits được cộng
  transaction_id VARCHAR(255), -- ID giao dịch từ SePay
  transaction_content TEXT, -- Nội dung giao dịch (NAP {user_id})
  bank_account VARCHAR(50), -- Số tài khoản ngân hàng
  bank_name VARCHAR(100), -- Tên ngân hàng
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  qr_url TEXT, -- URL mã QR
  sepay_data JSONB, -- Dữ liệu raw từ SePay webhook
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Tạo index để tìm kiếm nhanh
CREATE INDEX IF NOT EXISTS payments_user_id_idx ON payments(user_id);
CREATE INDEX IF NOT EXISTS payments_status_idx ON payments(status);
CREATE INDEX IF NOT EXISTS payments_created_at_idx ON payments(created_at DESC);
CREATE INDEX IF NOT EXISTS payments_transaction_id_idx ON payments(transaction_id);

-- Tạo trigger để tự động cập nhật updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_payments_updated_at 
  BEFORE UPDATE ON payments 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Tạo bảng lưu cấu hình thanh toán
CREATE TABLE IF NOT EXISTS payment_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_account VARCHAR(50) NOT NULL,
  bank_id VARCHAR(10) NOT NULL, -- Mã ngân hàng (MB, VCB, etc.)
  bank_name VARCHAR(100) NOT NULL,
  qr_template_url VARCHAR(500) NOT NULL DEFAULT 'https://qr.sepay.vn/img?acc={bank_acc}&bank={bank_id}&amount={amount}&des={content}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Thêm dữ liệu mẫu cho cấu hình thanh toán
INSERT INTO payment_configs (bank_account, bank_id, bank_name, qr_template_url, is_active) 
VALUES 
  ('0123456789', 'MB', 'MB Bank', 'https://qr.sepay.vn/img?acc={bank_acc}&bank={bank_id}&amount={amount}&des={content}', true),
  ('9876543210', 'VCB', 'Vietcombank', 'https://qr.sepay.vn/img?acc={bank_acc}&bank={bank_id}&amount={amount}&des={content}', true)
ON CONFLICT DO NOTHING;
```

## Bước 4: Kiểm tra kết quả
Sau khi chạy SQL thành công, kiểm tra:
1. **Table editor / `\dt`** → Có 2 bảng mới: `payments` và `payment_configs`
2. **`payment_configs`** → Có 2 dòng dữ liệu mẫu
3. **`payments`** → Trống (sẽ có dữ liệu khi người dùng nạp tiền)

## Bước 5: Cập nhật thông tin ngân hàng thực tế
Sau khi migration thành công, cần cập nhật thông tin ngân hàng thực tế:

1. Mở bảng **`payment_configs`** (UI hoặc `UPDATE` qua SQL)
2. Cập nhật thông tin ngân hàng thực tế:
   - `bank_account`: Số tài khoản ngân hàng thực tế
   - `bank_id`: Mã ngân hàng (MB, VCB, VPB, TCB, etc.)
   - `bank_name`: Tên ngân hàng đầy đủ
   - `is_active`: `true` để kích hoạt

## Bước 6: Cấu hình SePay Webhook
1. Đăng nhập vào **SePay Dashboard**
2. Vào phần **Webhook Settings**
3. Thêm webhook URL: `https://your-domain.com/api/sepay-webhook`
   - Nếu đang dev local: `http://localhost:3000/api/sepay-webhook`
4. Lưu cấu hình

## Bước 7: Test hệ thống
1. **Chạy ứng dụng**: `npm run dev`
2. **Đăng nhập** vào tài khoản
3. **Vào trang nạp tiền**: `/dashboard/deposit`
4. **Test tạo mã QR** và thanh toán thử

## Lưu ý quan trọng

### 1. Bảng `credits` đã tồn tại chưa?
Hệ thống cần bảng `credits` để lưu số dư của người dùng. Nếu chưa có, cần tạo:

```sql
-- Tạo bảng credits nếu chưa tồn tại
CREATE TABLE IF NOT EXISTS credits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  balance INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tạo trigger cho updated_at
CREATE TRIGGER update_credits_updated_at 
  BEFORE UPDATE ON credits 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();
```

### 2. Row Level Security (RLS)
Đảm bảo RLS được bật cho các bảng mới:
- `payments`: Người dùng chỉ xem được giao dịch của mình
- `payment_configs`: Công khai (public)
- `credits`: Người dùng chỉ xem được số dư của mình

### 3. Troubleshooting
Nếu gặp lỗi khi chạy SQL:
- **Lỗi permission**: Đảm bảo đang dùng service role key
- **Lỗi syntax**: Kiểm tra lại SQL, chạy từng phần nhỏ
- **Lỗi duplicate**: Bảng đã tồn tại, có thể bỏ qua

## Kết quả mong đợi
Sau khi migration thành công, hệ thống sẽ có:
- ✅ Bảng `payments` để lưu giao dịch
- ✅ Bảng `payment_configs` để lưu cấu hình ngân hàng  
- ✅ Bảng `credits` để lưu số dư người dùng
- ✅ API webhook để nhận callback từ SePay
- ✅ Trang nạp tiền với mã QR động
- ✅ Trang lịch sử giao dịch

Bây giờ hệ thống thanh toán đã sẵn sàng để sử dụng! 🎉