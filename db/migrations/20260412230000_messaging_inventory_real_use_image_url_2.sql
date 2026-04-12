-- Ảnh minh họa mặc/dùng thứ 2 (cache theo mặt hàng; tối đa 2 ảnh gửi khách mỗi cuộc chat).
alter table public.messaging_partner_inventory
  add column if not exists real_use_image_url_2 text not null default '';

comment on column public.messaging_partner_inventory.real_use_image_url_2 is
  'URL ảnh minh họa mặc/dùng thực tế (lần 2), public HTTPS; bổ sung cho real_use_image_url.';
