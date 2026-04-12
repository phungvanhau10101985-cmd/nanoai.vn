-- Chất liệu đã lưu (shop nhập hoặc AI suy từ ảnh) — dùng lại cho câu hỏi sau.
alter table public.messaging_partner_inventory
  add column if not exists material_note text not null default '';

comment on column public.messaging_partner_inventory.material_note is
  'Chất liệu/vải (shop nhập hoặc hệ thống suy từ ảnh sản phẩm khi khách hỏi).';
