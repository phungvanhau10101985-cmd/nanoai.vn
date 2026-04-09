-- SQL kiểm tra / cập nhật QR template (bảng payment_configs trên Postgres)

-- 1. Kiểm tra QR template hiện tại
SELECT 
  id,
  bank_name,
  bank_id,
  bank_account,
  qr_template_url,
  is_active
FROM payment_configs
WHERE is_active = true;

-- 2. Cập nhật QR template đúng format cho SePay
--    Format: https://qr.sepay.vn/{bank_id}/{bank_acc}/{amount}/{content}
UPDATE payment_configs 
SET 
  qr_template_url = 'https://qr.sepay.vn/{bank_id}/{bank_acc}/{amount}/{content}',
  updated_at = NOW()
WHERE is_active = true;

-- 3. Hoặc dùng VietQR template (nếu muốn)
-- UPDATE payment_configs 
-- SET 
--   qr_template_url = 'https://img.vietqr.io/image/{bank_id}-{bank_acc}-compact2.png?amount={amount}&addInfo={content}&accountName=THU%20DO%20ONLINE',
--   updated_at = NOW()
-- WHERE is_active = true;

-- 4. Kiểm tra kết quả
SELECT 
  bank_name,
  qr_template_url,
  'Ví dụ URL với amount=6000, content=NAPtest123:' as example,
  REPLACE(
    REPLACE(
      REPLACE(
        REPLACE(
          qr_template_url,
          '{bank_id}', bank_id
        ),
        '{bank_acc}', bank_account
      ),
      '{amount}', '6000'
    ),
    '{content}', 'NAPtest123'
  ) as example_url
FROM payment_configs
WHERE is_active = true;