-- Ảnh collage chi tiết chất liệu/màu (AI tạo, cache theo mặt hàng kho).
alter table public.messaging_partner_inventory
  add column if not exists material_detail_image_url text not null default '';

comment on column public.messaging_partner_inventory.material_detail_image_url is
  'URL HTTPS ảnh chi tiết chất liệu/màu (collage) — tạo một lần khi khách hỏi chất liệu, tái sử dụng cho lượt sau.';
