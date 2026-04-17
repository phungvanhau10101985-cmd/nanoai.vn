-- Meta Pixel (browser) + Conversions API (server) — cài đặt từng shop
alter table public.messaging_partners
  add column if not exists facebook_pixel_id text null,
  add column if not exists facebook_capi_access_token text null;

comment on column public.messaging_partners.facebook_pixel_id is 'Meta Pixel ID — fbq init trên trang tư vấn';
comment on column public.messaging_partners.facebook_capi_access_token is 'Meta Conversions API access token — gửi ViewContent server-side';
