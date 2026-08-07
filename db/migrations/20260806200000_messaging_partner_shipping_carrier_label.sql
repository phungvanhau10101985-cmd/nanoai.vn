-- M1.4 — display-only shipping carrier label (no carrier API).
alter table public.messaging_partner_payment_settings
  add column if not exists shipping_carrier_label text not null default '';

comment on column public.messaging_partner_payment_settings.shipping_carrier_label is
  'M1.4 Display label for shipping unit (e.g. GHN, GHTK) — no API integration';
