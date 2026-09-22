-- PDP outfit picks — persist complementary inventory ids per shop product (188 product_outfit_picks).
-- Additive. Same table for every workspace — no slug lock.

create table if not exists public.messaging_partner_outfit_picks (
  partner_id uuid not null,
  inventory_id uuid not null,
  algo_version text not null,
  payload jsonb not null,
  computed_at timestamptz not null default now(),
  primary key (partner_id, inventory_id)
);

create index if not exists idx_mp_outfit_picks_computed_at
  on public.messaging_partner_outfit_picks (computed_at);

comment on table public.messaging_partner_outfit_picks is
  'Storefront PDP outfit slot ids (algo v8, 7-day TTL). Hydrate live cards at response time.';
