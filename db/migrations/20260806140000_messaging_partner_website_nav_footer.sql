-- W2.3 — merchant edit nav / footer (additive jsonb, null = dùng default React shell).
alter table public.messaging_partner_websites
  add column if not exists nav_json jsonb null,
  add column if not exists footer_json jsonb null;

comment on column public.messaging_partner_websites.nav_json is
  'W2.3 optional header nav links [{id,hrefKey,labelOverride,visible,sortOrder}]';
comment on column public.messaging_partner_websites.footer_json is
  'W2.3 optional footer link groups [{id,hrefKey,labelOverride,visible,sortOrder}]';
