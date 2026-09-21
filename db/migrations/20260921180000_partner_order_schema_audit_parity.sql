-- Additive audit metadata for fulfillment timeline parity.
-- Data reconciliation is intentionally handled by the dry-run-first
-- scripts/reconcile-partner-order-schema-parity.mjs utility.

alter table public.messaging_partner_orders
  add column if not exists timeline_schema_version integer not null default 1;

alter table public.messaging_partner_order_shipment_events
  add column if not exists actor_type text not null default 'system',
  add column if not exists actor_id text,
  add column if not exists idempotency_key text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'messaging_partner_order_shipment_events_actor_type_check'
  ) then
    alter table public.messaging_partner_order_shipment_events
      add constraint messaging_partner_order_shipment_events_actor_type_check
      check (actor_type in ('system', 'cron', 'admin', 'ems', 'customer')) not valid;
  end if;
end $$;

-- The unique idempotency index is installed by explicit reconcile --apply
-- after legacy duplicate keys have been rewritten deterministically.

create index if not exists idx_mp_orders_timeline_schema_version
  on public.messaging_partner_orders (timeline_schema_version);

comment on column public.messaging_partner_orders.timeline_schema_version is
  'Persisted shipment timeline schema version; current version is 1.';
comment on column public.messaging_partner_order_shipment_events.idempotency_key is
  'Stable per-order event mutation key; legacy rows are backfilled from their immutable event id.';
