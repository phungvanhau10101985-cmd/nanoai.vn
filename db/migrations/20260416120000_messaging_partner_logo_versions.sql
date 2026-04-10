create table if not exists public.messaging_partner_logo_versions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  source_logo_url text not null,
  normalized_logo_url text not null,
  model text not null default '',
  prompt text not null default '',
  status text not null default 'done' check (status in ('done', 'failed')),
  charged_credits numeric(10,1) not null default 1.5,
  created_by uuid references auth.users (id) on delete set null,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_partner_logo_versions_partner_created
  on public.messaging_partner_logo_versions (partner_id, created_at desc);

create unique index if not exists uq_partner_logo_versions_active_per_partner
  on public.messaging_partner_logo_versions (partner_id)
  where is_active = true;
