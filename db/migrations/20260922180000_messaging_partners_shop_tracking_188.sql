-- Shop tracking 188 parity: Ads conversion labels, verification metas, custom HTML slots,
-- TikTok Events API token (store only, no sender). Additive; existing pixel ID columns stay.

alter table public.messaging_partners
  add column if not exists ads_conversion_pdp text,
  add column if not exists ads_conversion_add_to_cart text,
  add column if not exists ads_conversion_begin_checkout text,
  add column if not exists ads_conversion_deposit_page text,
  add column if not exists ads_conversion_purchase text,
  add column if not exists google_search_console_verify text,
  add column if not exists google_merchant_center_verify text,
  add column if not exists facebook_domain_verification text,
  add column if not exists custom_embed_head_html text,
  add column if not exists custom_embed_body_open_html text,
  add column if not exists custom_embed_body_close_html text,
  add column if not exists tiktok_events_api_token text;

comment on column public.messaging_partners.ads_conversion_pdp is 'Google Ads send_to AW-/label for PDP view_item';
comment on column public.messaging_partners.ads_conversion_add_to_cart is 'Google Ads send_to AW-/label for AddToCart';
comment on column public.messaging_partners.ads_conversion_begin_checkout is 'Google Ads send_to AW-/label for BeginCheckout';
comment on column public.messaging_partners.ads_conversion_deposit_page is 'Google Ads send_to AW-/label for deposit page';
comment on column public.messaging_partners.ads_conversion_purchase is 'Google Ads send_to AW-/label for Purchase';
comment on column public.messaging_partners.google_search_console_verify is 'google-site-verification content';
comment on column public.messaging_partners.google_merchant_center_verify is 'google-site-verification / merchant verify content';
comment on column public.messaging_partners.facebook_domain_verification is 'facebook-domain-verification content';
comment on column public.messaging_partners.custom_embed_head_html is 'Sanitized merchant HTML in head';
comment on column public.messaging_partners.custom_embed_body_open_html is 'Sanitized merchant HTML after body open';
comment on column public.messaging_partners.custom_embed_body_close_html is 'Sanitized merchant HTML before body close';
comment on column public.messaging_partners.tiktok_events_api_token is 'TikTok Events API token — stored only, not sent server-side yet';
