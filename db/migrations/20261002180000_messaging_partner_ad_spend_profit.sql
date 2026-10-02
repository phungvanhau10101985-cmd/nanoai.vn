-- Tỷ giá, ship chung và giá nhập riêng từng đơn cho mục lợi nhuận shop.

alter table public.messaging_partner_ad_spend
  add column if not exists vnd_per_cny numeric(14, 4),
  add column if not exists ship_china_domestic_cny numeric(14, 2) not null default 0,
  add column if not exists ship_border_to_hanoi_cny numeric(14, 2) not null default 0,
  add column if not exists ship_hanoi_to_customer_vnd numeric(14, 2) not null default 0;

comment on column public.messaging_partner_ad_spend.vnd_per_cny is
  'Tỷ giá ₫ / 1 ¥ dùng quy giá vốn hàng tệ. Trống = tỷ giá cào mặc định.';
comment on column public.messaging_partner_ad_spend.ship_china_domestic_cny is
  'Ship Trung Quốc nội địa mặc định, ¥ mỗi đơn có hàng tệ.';
comment on column public.messaging_partner_ad_spend.ship_border_to_hanoi_cny is
  'Ship cửa khẩu về Hà Nội mặc định, ¥ mỗi đơn có hàng tệ.';
comment on column public.messaging_partner_ad_spend.ship_hanoi_to_customer_vnd is
  'Ship Hà Nội đến khách mặc định, ₫ mỗi đơn.';

create table if not exists public.messaging_partner_ad_spend_order_costs (
  order_id uuid primary key references public.messaging_partner_orders (id) on delete cascade,
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  goods_cny numeric(14, 2),
  ship_china_domestic_cny numeric(14, 2),
  ship_border_to_hanoi_cny numeric(14, 2),
  ship_hanoi_to_customer_vnd numeric(14, 2),
  updated_at timestamptz not null default now()
);

create index if not exists idx_messaging_partner_ad_spend_order_costs_partner
  on public.messaging_partner_ad_spend_order_costs (partner_id);

comment on table public.messaging_partner_ad_spend_order_costs is
  'Giá hàng tệ và ship ghi đè cho một đơn. Ô trống nghĩa là dùng mức chung hoặc giá catalog.';
