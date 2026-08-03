-- Partner site shop checkout: require OTP/email login vs guest checkout (name/phone/address only).
alter table public.messaging_partner_ai_settings
  add column if not exists shop_checkout_login_required boolean not null default true;

comment on column public.messaging_partner_ai_settings.shop_checkout_login_required is
  'When true, /site/{slug} checkout requires guest OTP/email login. When false, checkout with delivery form only.';
