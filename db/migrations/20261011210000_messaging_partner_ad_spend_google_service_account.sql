-- Google Ads đọc chi phí bằng service account (không hết hạn như refresh token).

alter table public.messaging_partner_ad_spend
  add column if not exists google_service_account_json text;

comment on column public.messaging_partner_ad_spend.google_service_account_json is
  'JSON khóa service account (client_email, private_key, private_key_id). Không trả ra trình duyệt.';
