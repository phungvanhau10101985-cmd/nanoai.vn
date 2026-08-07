-- S0.3 — Meta CAPI retry outbox (MVP). Failed sends are queued and retried.
create table if not exists public.messaging_partner_meta_capi_outbox (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  event_id text not null,
  event_name text not null,
  payload jsonb not null,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'dead')),
  attempts int not null default 0,
  last_error text not null default '',
  next_retry_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists messaging_partner_meta_capi_outbox_retry_idx
  on public.messaging_partner_meta_capi_outbox (status, next_retry_at)
  where status = 'pending';

create index if not exists messaging_partner_meta_capi_outbox_partner_idx
  on public.messaging_partner_meta_capi_outbox (partner_id, created_at desc);

comment on table public.messaging_partner_meta_capi_outbox is
  'S0.3 Meta Conversions API outbox for retry on transient failures';
