-- Chữ OCR trên ảnh sản phẩm, đã lọc. Chỉ AI tư vấn đọc. Không hiện storefront.

alter table public.messaging_partner_inventory
  add column if not exists image_consult_context jsonb;

comment on column public.messaging_partner_inventory.image_consult_context is
  'Chữ đọc trên ảnh đã lọc (chất liệu, size, cách dùng, công suất). Chỉ prompt tư vấn. Không hiện web, không vào tìm kiếm.';
