-- Hai chế độ: đặt trong chat vs chuyển sang website shop khi khách bấm Mua hàng.
alter table public.messaging_partner_ai_settings
  add column if not exists guest_purchase_flow text not null default 'in_chat'
    check (guest_purchase_flow in ('in_chat', 'external_site'));

comment on column public.messaging_partner_ai_settings.guest_purchase_flow is
  'in_chat: tạo đơn/đặt hàng trong luồng chat; external_site: mở product_url (trang shop) khi bấm Mua.';
