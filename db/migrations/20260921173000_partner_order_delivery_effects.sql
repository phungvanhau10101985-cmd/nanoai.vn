-- Idempotency ledger for delivered-order side effects shared by EMS, customer and admin paths.
-- Additive and intentionally separate from inventory/stock migrations.

create table if not exists public.messaging_partner_order_delivery_effects (
  order_id uuid not null references public.messaging_partner_orders (id) on delete cascade,
  effect_key text not null,
  status text not null default 'running',
  attempts int not null default 1,
  claim_token uuid not null default gen_random_uuid(),
  claimed_at timestamptz not null default now(),
  completed_at timestamptz,
  last_error text not null default '',
  updated_at timestamptz not null default now(),
  primary key (order_id, effect_key),
  constraint messaging_partner_order_delivery_effects_status_check
    check (status in ('running', 'completed', 'failed'))
);

alter table public.messaging_partner_order_delivery_effects
  add column if not exists claim_token uuid not null default gen_random_uuid();

create index if not exists idx_mp_order_delivery_effects_retry
  on public.messaging_partner_order_delivery_effects (status, updated_at)
  where status <> 'completed';

comment on table public.messaging_partner_order_delivery_effects is
  'Per-effect idempotency ledger for unified delivered hooks (EMS/customer/admin).';
