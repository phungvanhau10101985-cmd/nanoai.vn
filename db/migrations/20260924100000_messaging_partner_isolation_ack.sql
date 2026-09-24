-- Xác nhận tay trên checklist tách bạch shop (tài khoản Google, Merchant Center, hồ sơ trả tiền, Search Console, trang đơn vị).
alter table public.messaging_partners
  add column if not exists isolation_ack_json jsonb not null default '{}'::jsonb;

comment on column public.messaging_partners.isolation_ack_json is
  'Checklist tách bạch: operator xác nhận tài khoản Google Ads, Merchant Center, hồ sơ thanh toán ads, Search Console và trang Thông tin đơn vị thuộc đúng shop này.';
