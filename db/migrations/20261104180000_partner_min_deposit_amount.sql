-- Sàn tiền cọc một phần, cùng ô «Cọc tối thiểu» trên 188. Không thấp hơn 100.000đ.

alter table public.messaging_partner_payment_settings
  add column if not exists min_deposit_amount_vnd integer not null default 100000;

comment on column public.messaging_partner_payment_settings.min_deposit_amount_vnd is
  'Sàn tiền cọc theo % (VND). Không thấp hơn 100.000. Không vượt tiền hàng.';
