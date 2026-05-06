-- Loyalty/member tiers for fashion messaging partners.
-- Per-workspace configuration; checkout stores a snapshot on each order.

create table if not exists public.messaging_partner_loyalty_settings (
  partner_id uuid primary key references public.messaging_partners (id) on delete cascade,
  enabled boolean not null default true,
  spend_window_days int not null default 180 check (spend_window_days >= 30 and spend_window_days <= 730),
  max_total_discount_percent numeric(5, 2) not null default 30 check (max_total_discount_percent >= 0 and max_total_discount_percent <= 100),
  updated_at timestamptz not null default now()
);

comment on table public.messaging_partner_loyalty_settings is
  'Cấu hình hạng thành viên theo workspace nhắn tin; áp dụng cho shop thời trang/non-hotel.';

create table if not exists public.messaging_partner_loyalty_tiers (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  tier_code text not null,
  tier_name text not null,
  min_spend_6_months numeric(14, 2) not null default 0 check (min_spend_6_months >= 0),
  discount_percent numeric(5, 2) not null default 0 check (discount_percent >= 0 and discount_percent <= 100),
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint messaging_partner_loyalty_tiers_partner_code_unique unique (partner_id, tier_code)
);

create index if not exists idx_messaging_partner_loyalty_tiers_partner_sort
  on public.messaging_partner_loyalty_tiers (partner_id, is_active, min_spend_6_months, sort_order);

comment on table public.messaging_partner_loyalty_tiers is
  'Các hạng thành viên theo shop: mốc chi tiêu trong cửa sổ cấu hình + % giảm đơn hàng.';

create or replace function public.trg_messaging_partner_loyalty_tiers_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tr_messaging_partner_loyalty_tiers_updated_at on public.messaging_partner_loyalty_tiers;
create trigger tr_messaging_partner_loyalty_tiers_updated_at
  before update on public.messaging_partner_loyalty_tiers
  for each row
  execute function public.trg_messaging_partner_loyalty_tiers_updated_at();

create or replace function public.trg_messaging_partner_loyalty_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tr_messaging_partner_loyalty_settings_updated_at on public.messaging_partner_loyalty_settings;
create trigger tr_messaging_partner_loyalty_settings_updated_at
  before update on public.messaging_partner_loyalty_settings
  for each row
  execute function public.trg_messaging_partner_loyalty_settings_updated_at();

insert into public.messaging_partner_loyalty_settings (partner_id, enabled, spend_window_days, max_total_discount_percent)
select mp.id, true, 180, 30
from public.messaging_partners mp
where coalesce(mp.industry_key, 'fashion') <> 'hotel'
on conflict (partner_id) do nothing;

insert into public.messaging_partner_loyalty_tiers (
  partner_id, tier_code, tier_name, min_spend_6_months, discount_percent, sort_order, is_active
)
select mp.id, seed.tier_code, seed.tier_name, seed.min_spend_6_months, seed.discount_percent, seed.sort_order, true
from public.messaging_partners mp
cross join (
  values
    ('L1', 'L1', 0::numeric, 0::numeric, 0),
    ('L2', 'L2', 4000000::numeric, 2::numeric, 1),
    ('L3', 'L3', 8000000::numeric, 4::numeric, 2),
    ('L4', 'L4', 12000000::numeric, 6::numeric, 3),
    ('L5', 'L5', 20000000::numeric, 10::numeric, 4)
) as seed(tier_code, tier_name, min_spend_6_months, discount_percent, sort_order)
where coalesce(mp.industry_key, 'fashion') <> 'hotel'
on conflict (partner_id, tier_code) do nothing;

alter table if exists public.messaging_partner_orders
  add column if not exists loyalty_tier_code text not null default '',
  add column if not exists loyalty_tier_name text not null default '',
  add column if not exists loyalty_discount_percent numeric(5, 2) not null default 0,
  add column if not exists loyalty_discount_amount numeric(14, 2) not null default 0,
  add column if not exists birthday_discount_percent numeric(5, 2) not null default 0,
  add column if not exists birthday_discount_amount numeric(14, 2) not null default 0,
  add column if not exists total_discount_percent numeric(5, 2) not null default 0,
  add column if not exists total_discount_amount numeric(14, 2) not null default 0,
  add column if not exists amount_after_discount numeric(14, 2) not null default 0;

update public.messaging_partner_orders
set amount_after_discount = coalesce(nullif(amount_after_discount, 0), subtotal_amount, 0)
where coalesce(amount_after_discount, 0) = 0
  and coalesce(subtotal_amount, 0) > 0;

