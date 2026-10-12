-- Ảnh thông số (版型 / 柔软 / 厚度 / 弹力) dùng lại cùng khóa với ảnh size và ảnh giặt.

alter table public.messaging_partner_image_localization_sheets
  drop constraint if exists messaging_partner_image_loc_sheets_kind_chk;

alter table public.messaging_partner_image_localization_sheets
  add constraint messaging_partner_image_loc_sheets_kind_chk
  check (kind in ('size', 'laundry', 'params'));

comment on table public.messaging_partner_image_localization_sheets is
  'Ảnh bảng size, hướng dẫn giặt hoặc bảng thông số đã dịch. Khóa: shop SaaS, tên shop Trung Quốc, danh mục cấp 2, ngôn ngữ, loại ảnh.';
