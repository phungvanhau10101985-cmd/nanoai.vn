-- Trần đơn giá: từ mức này trở lên khách cọc tối thiểu %. Mặc định 3.000.000đ / 30%.
-- 0 = tắt luật đó. Hàng thanh lý kho không áp dụng (xử lý ở checkout, không ở cột này).

alter table public.messaging_partner_payment_settings
  add column if not exists high_unit_price_deposit_threshold_vnd numeric not null default 3000000,
  add column if not exists high_unit_price_min_deposit_percent integer not null default 30;

comment on column public.messaging_partner_payment_settings.high_unit_price_deposit_threshold_vnd is
  'Đơn giá (VND) từ mức này trở lên thì khách cọc ít nhất high_unit_price_min_deposit_percent. 0 = tắt.';
comment on column public.messaging_partner_payment_settings.high_unit_price_min_deposit_percent is
  'Cọc tối thiểu (%) khi đơn giá chạm trần. 0 = tắt.';
