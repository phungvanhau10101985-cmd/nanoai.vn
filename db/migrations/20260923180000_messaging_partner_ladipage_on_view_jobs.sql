-- PDP LadiPage on view: queue one landing per product the shopper opened.
-- Generation runs on cron, not inside the view request.

create table if not exists public.messaging_partner_ladipage_on_view_jobs (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  inventory_id uuid not null,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'done', 'error', 'skipped')),
  attempts int not null default 0,
  last_error text null,
  claimed_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists uq_ladipage_on_view_active
  on public.messaging_partner_ladipage_on_view_jobs (partner_id, inventory_id)
  where status in ('pending', 'running');

create index if not exists idx_ladipage_on_view_pending
  on public.messaging_partner_ladipage_on_view_jobs (created_at)
  where status = 'pending';

create index if not exists idx_landing_pages_inventory_ids
  on public.messaging_partner_landing_pages using gin (inventory_ids);

comment on table public.messaging_partner_ladipage_on_view_jobs is
  'Queue a 1-product landing after a storefront view. Cron generates sections; the PDP request does not wait.';
