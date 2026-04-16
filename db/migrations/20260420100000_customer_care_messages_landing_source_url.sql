-- URL trang nơi khách gửi tin (widget): nguồn cho phân tích / feed marketing (Google, Facebook catalog, UTM).

alter table public.customer_care_messages
  add column if not exists landing_source_url text null;

comment on column public.customer_care_messages.landing_source_url is
  'URL trang (thường window.location.href) khi khách gửi tin inbound từ widget — gắn nguồn traffic / feed Google Facebook.';
