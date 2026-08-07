-- S0.4/M3.1 (docs/PARTNER_WEBSITE_AND_LANDING_UPGRADE_188.md): GTM container theo từng shop.
-- Additive-only, cùng mẫu với google_ads_id/tiktok_pixel_id.
alter table public.messaging_partners
  add column if not exists gtm_container_id text null;

comment on column public.messaging_partners.gtm_container_id is 'Google Tag Manager container ID (GTM-XXXXXXX) — merchant tự nhập, tự sinh bootstrap script + noscript iframe trên trang shop công khai';
