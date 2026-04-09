-- Thêm cột tên chủ tài khoản vào payment_configs (nếu bảng tồn tại)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_configs') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_configs' AND column_name = 'account_holder_name') THEN
      ALTER TABLE payment_configs ADD COLUMN account_holder_name text;
    END IF;
  END IF;
END $$;
