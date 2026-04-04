-- Link trang sản phẩm (web khách) + API tìm kiếm ảnh công khai (Bearer)

alter table public.messaging_partner_inventory
  add column if not exists product_url text not null default '';

comment on column public.messaging_partner_inventory.product_url is
  'URL trang chi tiết sản phẩm trên website shop (HTTPS) — trả về khi tìm kiếm bằng ảnh.';

alter table public.messaging_partner_ai_settings
  add column if not exists image_search_api_enabled boolean not null default false,
  add column if not exists image_search_api_secret text null;

comment on column public.messaging_partner_ai_settings.image_search_api_enabled is
  'Khi bật và có secret: cho phép POST /api/messaging/partners/{id}/image-search với Authorization Bearer.';
comment on column public.messaging_partner_ai_settings.image_search_api_secret is
  'Khóa Bearer cho API tìm ảnh (không commit; chỉ shop chủ tạo/lưu trên server).';
