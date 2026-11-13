-- Click id, browser id, IP và UA của khách NanoAI để Purchase server (webhook ngân hàng)
-- gửi lại đúng máy khách, không gửi IP của SePay.

create table if not exists public.platform_meta_client_match (
  user_id uuid primary key,
  fbc text,
  fbp text,
  client_ip text,
  user_agent text,
  updated_at timestamptz not null default now()
);

comment on table public.platform_meta_client_match is
  'Ngữ cảnh trình duyệt gần nhất của user nền tảng, dùng khi CAPI Purchase không còn cookie.';
