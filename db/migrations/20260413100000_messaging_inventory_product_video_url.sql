-- Video sản phẩm: YouTube (watch/embed) hoặc URL file .mp4 (CDN), lưu nguyên chuỗi https.

alter table public.messaging_partner_inventory
  add column if not exists product_video_url text not null default '';

comment on column public.messaging_partner_inventory.product_video_url is
  'URL video (YouTube hoặc HTTPS trực tiếp tới .mp4 / player); đưa vào kho & Excel.';
