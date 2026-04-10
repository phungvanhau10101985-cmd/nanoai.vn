-- Add order timeline events + shipping status + lock behavior.

alter table if exists public.messaging_partner_orders
  add column if not exists shipping_status text not null default 'pending';

alter table if exists public.messaging_partner_orders
  add column if not exists locked_at timestamptz null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'messaging_partner_orders_shipping_status_check'
  ) then
    alter table public.messaging_partner_orders
      add constraint messaging_partner_orders_shipping_status_check
      check (shipping_status in ('pending', 'confirmed', 'packing', 'shipping', 'delivered', 'returned', 'cancelled'));
  end if;
end $$;

create table if not exists public.messaging_partner_order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.messaging_partner_orders (id) on delete cascade,
  event_type text not null default 'note',
  title text not null default '',
  detail text not null default '',
  source text not null default 'system',
  created_by text not null default '',
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_messaging_partner_order_events_order_created
  on public.messaging_partner_order_events (order_id, created_at desc);
