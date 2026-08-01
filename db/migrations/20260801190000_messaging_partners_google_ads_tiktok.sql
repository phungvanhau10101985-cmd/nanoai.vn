-- Google Ads (AW-...) + TikTok Pixel for partner shop / website tracking
alter table public.messaging_partners
  add column if not exists google_ads_id text null,
  add column if not exists tiktok_pixel_id text null;

comment on column public.messaging_partners.google_ads_id is 'Google Ads conversion / dynamic remarketing tag ID (AW-...) — gtag config on partner shop & consult pages';
comment on column public.messaging_partners.tiktok_pixel_id is 'TikTok Pixel ID — ttq on partner shop & consult pages';
