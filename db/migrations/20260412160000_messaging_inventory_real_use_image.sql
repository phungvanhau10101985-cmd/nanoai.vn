-- Ảnh minh họa khách dùng / mặc sản phẩm (AI từ ảnh mẫu), cache theo dòng kho.
alter table public.messaging_partner_inventory
  add column if not exists real_use_image_url text not null default '';

comment on column public.messaging_partner_inventory.real_use_image_url is
  'URL HTTPS ảnh minh họa sử dụng sản phẩm thực tế (AI) — tạo khi khách hỏi ảnh thực tế, tái dùng cho lượt sau.';
