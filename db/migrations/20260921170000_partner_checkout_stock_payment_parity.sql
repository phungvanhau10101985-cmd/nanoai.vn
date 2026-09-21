-- Additive checkout stock reservation and partner SePay webhook idempotency.
-- Existing stock_qty remains the physical on-hand quantity. warehouse_reserved
-- is the subset promised to open orders and is never backfilled from old holds.

alter table public.messaging_partner_inventory
  add column if not exists warehouse_reserved integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'messaging_partner_inventory_warehouse_reserved_nonnegative'
  ) then
    alter table public.messaging_partner_inventory
      add constraint messaging_partner_inventory_warehouse_reserved_nonnegative
      check (warehouse_reserved >= 0) not valid;
  end if;
end $$;

comment on column public.messaging_partner_inventory.warehouse_reserved is
  'Quantity reserved by open VN warehouse orders; available = stock_qty - warehouse_reserved.';

alter table public.messaging_partner_order_lines
  add column if not exists warehouse_stock_restored_at timestamptz,
  add column if not exists warehouse_stock_additive boolean not null default false;

-- Historical holds are intentionally untouched here. Run the reconciler in
-- dry-run mode, review its counts, then use its explicit --apply transaction.

create table if not exists public.messaging_partner_payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners(id) on delete cascade,
  provider text not null,
  provider_event_id text not null,
  payload_hash text not null default '',
  order_id uuid references public.messaging_partner_orders(id) on delete set null,
  status text not null default 'processing',
  attempts integer not null default 1,
  claim_token uuid not null default gen_random_uuid(),
  last_error text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (partner_id, provider, provider_event_id)
);

alter table public.messaging_partner_payment_webhook_events
  add column if not exists claim_token uuid not null default gen_random_uuid();

create table if not exists public.messaging_partner_parity_reconcile_archive (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  original_id text not null,
  canonical_id text,
  dedupe_key text not null default '',
  payload jsonb not null,
  archived_at timestamptz not null default now(),
  unique (entity_type, original_id)
);

comment on table public.messaging_partner_parity_reconcile_archive is
  'Lossless snapshots of rows removed from active parity ledgers by explicit reconcile --apply.';

create table if not exists public.messaging_partner_payment_webhook_effects (
  event_id uuid not null references public.messaging_partner_payment_webhook_events(id) on delete cascade,
  effect_key text not null,
  status text not null default 'running',
  attempts integer not null default 1,
  claim_token uuid not null default gen_random_uuid(),
  claimed_at timestamptz not null default now(),
  completed_at timestamptz,
  last_error text not null default '',
  updated_at timestamptz not null default now(),
  primary key (event_id, effect_key),
  constraint messaging_partner_payment_webhook_effects_status_check
    check (status in ('running', 'completed', 'failed'))
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'messaging_partner_payment_webhook_events_status_check'
  ) then
    alter table public.messaging_partner_payment_webhook_events
      add constraint messaging_partner_payment_webhook_events_status_check
      check (status in ('processing', 'completed', 'failed'));
  end if;
end $$;

create index if not exists idx_mp_payment_webhook_events_order
  on public.messaging_partner_payment_webhook_events (partner_id, order_id, created_at desc);
