-- W1.4 — lightweight flash sale windows on inventory (no bundle packs).
alter table public.messaging_partner_inventory
  add column if not exists sale_price_amount numeric,
  add column if not exists sale_starts_at timestamptz,
  add column if not exists sale_ends_at timestamptz;

comment on column public.messaging_partner_inventory.sale_price_amount is
  'W1.4 Flash sale price (same currency as price_amount); null = no sale';
comment on column public.messaging_partner_inventory.sale_starts_at is
  'W1.4 Sale window start (inclusive); null with sale_price = always on until sale_ends_at';
comment on column public.messaging_partner_inventory.sale_ends_at is
  'W1.4 Sale window end (exclusive); null = open-ended while sale_price set';
