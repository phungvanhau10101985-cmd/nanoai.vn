-- Cookie Playwright + tài khoản PandaMall theo workspace (parity import-1688/settings/cookie).
-- Additive. Không khóa slug shop.

create table if not exists public.messaging_partner_listing_import_settings (
  partner_id uuid primary key references public.messaging_partners (id) on delete cascade,
  cookie_json jsonb not null default '[]'::jsonb,
  pandamall_username text not null default '',
  pandamall_password text not null default '',
  updated_at timestamptz not null default now()
);

comment on table public.messaging_partner_listing_import_settings is
  'Cookie scrape Vipomall/PandaMall + tài khoản PandaMall theo partner_id.';
