-- Ảnh sản phẩm (URL công khai) + ghi chú tư vấn thêm cho AI.

alter table public.messaging_partner_inventory
  add column if not exists image_url text not null default '';

alter table public.messaging_partner_inventory
  add column if not exists consult_note text not null default '';

comment on column public.messaging_partner_inventory.image_url is 'HTTPS (hoặc HTTP) URL ảnh sản phẩm — hiển thị & đưa vào ngữ cảnh AI dạng text.';
comment on column public.messaging_partner_inventory.consult_note is 'Ghi chú tư vấn: bảo hành, thời gian giao, khuyến mãi, lưu ý đổi trả, v.v.';
