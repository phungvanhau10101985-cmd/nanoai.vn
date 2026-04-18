-- Cache tin mở đầu link tư vấn (AI) theo dòng kho — khách sau cùng SP dùng lại, không gọi LLM lặp.

alter table public.messaging_partner_inventory
  add column if not exists consult_link_opening_text text,
  add column if not exists consult_link_opening_input_fingerprint text;

comment on column public.messaging_partner_inventory.consult_link_opening_text is
  'Tin nhắn mở đầu khi khách bấm tư vấn từ link SP (do AI hoặc fallback).';
comment on column public.messaging_partner_inventory.consult_link_opening_input_fingerprint is
  'SHA-256 hex của input (tên + mô tả/ghi chú + SKU) — đổi khi sản phẩm sửa thì tạo lại tin.';
