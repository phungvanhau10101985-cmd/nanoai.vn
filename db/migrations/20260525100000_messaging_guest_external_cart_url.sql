-- Chế độ 3: Mua / Thêm giỏ mở link giỏ web shop (mẫu URL có {sku}).
alter table public.messaging_partner_ai_settings
  drop constraint if exists messaging_partner_ai_settings_guest_purchase_flow_check;

alter table public.messaging_partner_ai_settings
  add constraint messaging_partner_ai_settings_guest_purchase_flow_check
    check (guest_purchase_flow in ('in_chat', 'external_site', 'external_cart_url'));

alter table public.messaging_partner_ai_settings
  add column if not exists guest_external_cart_url_template text;

comment on column public.messaging_partner_ai_settings.guest_purchase_flow is
  'in_chat: đặt trong chat; external_site: Mua/Thêm giỏ/Xem chi tiết → product_url; external_cart_url: Mua/Thêm giỏ → mẫu URL có {sku}.';

comment on column public.messaging_partner_ai_settings.guest_external_cart_url_template is
  'Mẫu URL giỏ web shop, vd https://shop.vn/cart/add/{sku}?from=nanoai — chỉ dùng khi guest_purchase_flow = external_cart_url.';
