-- Persist customer delivery info by logged-in email per workspace.

create table if not exists public.messaging_partner_customer_profiles (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  email_normalized text not null,
  email_raw text not null default '',
  customer_name text not null default '',
  customer_phone text not null default '',
  shipping_address text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (partner_id, email_normalized)
);

create index if not exists idx_messaging_partner_customer_profiles_partner_updated
  on public.messaging_partner_customer_profiles (partner_id, updated_at desc);
