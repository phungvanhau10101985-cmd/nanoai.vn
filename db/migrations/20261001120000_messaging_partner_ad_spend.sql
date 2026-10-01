-- Khóa đọc chi phí Google Ads và Facebook Ads theo từng shop.

create table if not exists public.messaging_partner_ad_spend (
  partner_id uuid primary key references public.messaging_partners(id) on delete cascade,
  google_developer_token text,
  google_client_id text,
  google_client_secret text,
  google_refresh_token text,
  google_customer_id text,
  google_login_customer_id text,
  meta_access_token text,
  meta_ad_account_id text,
  updated_at timestamptz not null default now()
);

comment on table public.messaging_partner_ad_spend is
  'Khóa đọc chi phí quảng cáo của một shop. Không trả secret ra trình duyệt.';
