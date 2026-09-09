-- Parse HTML listing Taobao / 1688 → nháp scrape Vipomall/PandaMall → đăng kho (parity admin 188).
-- Additive, theo partner_id. Không khóa slug shop.

create table if not exists public.messaging_partner_listing_import_queues (
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  queue_token text not null,
  payload_json jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (partner_id, queue_token),
  constraint messaging_partner_listing_import_queues_token_chk
    check (queue_token ~ '^[a-f0-9]{32,64}$')
);

create index if not exists idx_mp_listing_import_queues_partner_updated
  on public.messaging_partner_listing_import_queues (partner_id, updated_at desc);

create table if not exists public.messaging_partner_listing_import_queue_revocations (
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  queue_token text not null,
  revoked_at timestamptz not null default now(),
  primary key (partner_id, queue_token),
  constraint messaging_partner_listing_import_revocations_token_chk
    check (queue_token ~ '^[a-f0-9]{32,64}$')
);

create table if not exists public.messaging_partner_listing_import_drafts (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  job_id text not null,
  source text not null default 'vipomall',
  source_url text not null default '',
  source_offer_id text,
  status text not null default 'queued',
  message text,
  errors jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  raw_payload jsonb,
  product_data jsonb,
  published_inventory_id uuid references public.messaging_partner_inventory (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (partner_id, job_id)
);

create index if not exists idx_mp_listing_import_drafts_partner_created
  on public.messaging_partner_listing_import_drafts (partner_id, created_at desc);
create index if not exists idx_mp_listing_import_drafts_partner_status
  on public.messaging_partner_listing_import_drafts (partner_id, status);
create index if not exists idx_mp_listing_import_drafts_partner_offer
  on public.messaging_partner_listing_import_drafts (partner_id, source_offer_id);

comment on table public.messaging_partner_listing_import_queues is
  'Snapshot hàng đợi cào listing HTML (Vipomall/PandaMall) theo workspace.';
comment on table public.messaging_partner_listing_import_drafts is
  'Nháp scrape trước khi đăng messaging_partner_inventory.';
