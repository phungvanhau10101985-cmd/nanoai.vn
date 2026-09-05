-- Per-workspace promo sandbox (parity 188 admin/test).
-- One row per dashboard staff on a partner. Storefront matches test_email only.
-- Feed / cron / catalog parity must never read this table.

create table if not exists public.messaging_partner_feature_test_settings (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  actor_user_id uuid not null,
  test_email text,
  birthday_promo_enabled boolean not null default false,
  birthday_promo_expires_at timestamptz,
  site_sale_test_enabled boolean not null default false,
  site_sale_test_expires_at timestamptz,
  site_sale_test_phase text not null default 'active'
    check (site_sale_test_phase in ('teaser', 'active')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (partner_id, actor_user_id)
);

create index if not exists idx_partner_feature_test_partner
  on public.messaging_partner_feature_test_settings (partner_id);

create index if not exists idx_partner_feature_test_email
  on public.messaging_partner_feature_test_settings (partner_id, lower(test_email))
  where coalesce(test_email, '') <> '';

comment on table public.messaging_partner_feature_test_settings is
  '188-style 10-minute CMSN / site-sale sandbox. Applies only to the matching shop login email.';
