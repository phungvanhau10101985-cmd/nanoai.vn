-- Ảnh màu/mẫu khách chọn (palette) — JSON mảng chuỗi URL, mặc định rỗng.
alter table public.messaging_partner_orders
  add column if not exists variant_image_urls text not null default '';

comment on column public.messaging_partner_orders.variant_image_urls is
  'JSON array of image URLs for selected color/variant lines (e.g. palette picks); empty string if none.';
