-- S0.7 — public contact channel links for shop storefront (not webhook tokens).
alter table public.messaging_partners
  add column if not exists contact_phone text,
  add column if not exists contact_zalo_url text,
  add column if not exists contact_messenger_url text,
  add column if not exists contact_instagram_url text;

comment on column public.messaging_partners.contact_phone is
  'S0.7 Public phone (tel:) shown on shop FAB / contact page';
comment on column public.messaging_partners.contact_zalo_url is
  'S0.7 Public Zalo chat URL (zalo.me/...)';
comment on column public.messaging_partners.contact_messenger_url is
  'S0.7 Public Messenger URL (m.me/...)';
comment on column public.messaging_partners.contact_instagram_url is
  'S0.7 Public Instagram profile or DM URL';
