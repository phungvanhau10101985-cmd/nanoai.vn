-- Google Ads chỉ đọc bằng JSON service account. Xóa OAuth client và refresh token (có hạn).

update public.messaging_partner_ad_spend
set google_client_id = null,
    google_client_secret = null,
    google_refresh_token = null
where google_client_id is not null
   or google_client_secret is not null
   or google_refresh_token is not null;

comment on column public.messaging_partner_ad_spend.google_client_id is
  'Ngừng dùng. Google Ads chỉ đọc bằng google_service_account_json.';
comment on column public.messaging_partner_ad_spend.google_client_secret is
  'Ngừng dùng. Google Ads chỉ đọc bằng google_service_account_json.';
comment on column public.messaging_partner_ad_spend.google_refresh_token is
  'Ngừng dùng. Google Ads chỉ đọc bằng google_service_account_json.';
