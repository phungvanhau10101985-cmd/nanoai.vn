-- Mặc định ưu đãi CMSN: cửa sổ "trước SN" = 7 ngày (1 tuần) thay vì 14.

alter table public.messaging_partner_birthday_promo
  alter column offer_days_before_max set default 7;
