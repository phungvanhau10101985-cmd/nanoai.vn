-- Ảnh size / giặt tẩy đã dịch, dùng lại theo shop SaaS + shop Trung Quốc + danh mục cấp 2.

create table if not exists public.messaging_partner_image_localization_sheets (
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  shop_name_chinese text not null,
  category_l2 text not null,
  language text not null,
  kind text not null,
  image_url text not null,
  updated_at timestamptz not null default now(),
  primary key (partner_id, shop_name_chinese, category_l2, language, kind),
  constraint messaging_partner_image_loc_sheets_kind_chk check (kind in ('size', 'laundry'))
);

comment on table public.messaging_partner_image_localization_sheets is
  'Ảnh bảng size hoặc hướng dẫn giặt đã dịch. Khóa: shop SaaS, tên shop Trung Quốc, danh mục cấp 2, ngôn ngữ, loại ảnh.';
