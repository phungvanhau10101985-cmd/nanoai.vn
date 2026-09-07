-- Flash sale kill switch (parity 188 sale_calendar_settings.flash_sale_enabled).
-- Personalized 10-minute deals; default on. Additive.

alter table public.messaging_partner_sale_calendar_settings
  add column if not exists flash_sale_enabled boolean not null default true;

comment on column public.messaging_partner_sale_calendar_settings.flash_sale_enabled is
  'Khối FLASH SALE + giảm 5–6% trên mã trong lượt. Tắt = ẩn khối và không giảm flash trên SP/giỏ.';
