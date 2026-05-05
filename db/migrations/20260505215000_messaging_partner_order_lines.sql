create table if not exists public.messaging_partner_order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.messaging_partner_orders (id) on delete cascade,
  product_inventory_id uuid null references public.messaging_partner_inventory (id) on delete set null,
  product_name text not null default '',
  product_image_url text not null default '',
  product_url text not null default '',
  unit_price numeric(14, 2) not null default 0,
  quantity int not null default 1 check (quantity > 0 and quantity <= 99),
  line_subtotal numeric(14, 2) not null default 0,
  variant_color text not null default '',
  variant_size text not null default '',
  variant_image_urls text not null default '',
  note text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_messaging_partner_order_lines_order_sort
  on public.messaging_partner_order_lines (order_id, sort_order, created_at, id);

insert into public.messaging_partner_order_lines (
  order_id, product_inventory_id, product_name, product_image_url, product_url,
  unit_price, quantity, line_subtotal, variant_color, variant_size, variant_image_urls, note, sort_order,
  created_at, updated_at
)
select
  o.id,
  o.product_inventory_id,
  coalesce(o.product_name, ''),
  coalesce(o.product_image_url, ''),
  coalesce(o.product_url, ''),
  coalesce(o.unit_price, 0),
  greatest(1, least(99, coalesce(o.quantity, 1))),
  coalesce(o.subtotal_amount, coalesce(o.unit_price, 0) * greatest(1, least(99, coalesce(o.quantity, 1)))),
  coalesce(o.variant_color, ''),
  coalesce(o.variant_size, ''),
  coalesce(o.variant_image_urls, ''),
  coalesce(o.note, ''),
  0,
  coalesce(o.created_at, now()),
  coalesce(o.updated_at, now())
from public.messaging_partner_orders o
where not exists (
  select 1
  from public.messaging_partner_order_lines l
  where l.order_id = o.id
);

comment on table public.messaging_partner_order_lines is
  'Line items for fashion messaging orders. Existing single-product orders are represented by one line.';
