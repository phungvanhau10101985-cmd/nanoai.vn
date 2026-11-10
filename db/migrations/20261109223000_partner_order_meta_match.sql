-- Ngữ cảnh trình duyệt lúc đặt hàng, để Purchase CAPI lúc xác nhận thanh toán
-- gửi lại cùng IP, UA, fbp, fbc, external_id.

create table if not exists public.messaging_partner_order_meta_match (
  order_id uuid primary key references public.messaging_partner_orders(id) on delete cascade,
  partner_id uuid not null,
  client_ip text,
  user_agent text,
  fbp text,
  fbc text,
  external_id text,
  updated_at timestamptz not null default now()
);

create index if not exists messaging_partner_order_meta_match_partner_idx
  on public.messaging_partner_order_meta_match (partner_id);
