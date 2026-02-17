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