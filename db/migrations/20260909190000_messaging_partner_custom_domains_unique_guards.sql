-- Đảm bảo unique(partner_id) + unique(hostname) tồn tại.
-- Bảng cũ tạo bằng CREATE TABLE IF NOT EXISTS có thể thiếu constraint → INSERT ON CONFLICT ném lỗi
-- (Next.js production hiện "Server Components render" khi lưu tên miền sau OTP).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'messaging_partner_custom_domains_partner_unique'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.messaging_partner_custom_domains
      GROUP BY partner_id
      HAVING count(*) > 1
    ) THEN
      ALTER TABLE public.messaging_partner_custom_domains
        ADD CONSTRAINT messaging_partner_custom_domains_partner_unique UNIQUE (partner_id);
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'messaging_partner_custom_domains_hostname_unique'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.messaging_partner_custom_domains
      GROUP BY hostname
      HAVING count(*) > 1
    ) THEN
      ALTER TABLE public.messaging_partner_custom_domains
        ADD CONSTRAINT messaging_partner_custom_domains_hostname_unique UNIQUE (hostname);
    END IF;
  END IF;
END $$;
