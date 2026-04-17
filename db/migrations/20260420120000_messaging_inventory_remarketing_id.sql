-- Id ngoài (pixel/remarketing) gắn từng dòng kho — import Excel / API.
alter table public.messaging_partner_inventory
  add column if not exists remarketing_id text;

comment on column public.messaging_partner_inventory.remarketing_id is
  'Mã id remarketing / pixel (tuỳ shop), nhập từ Excel hoặc API.';
