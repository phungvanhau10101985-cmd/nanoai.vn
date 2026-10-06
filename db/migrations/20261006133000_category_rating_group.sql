-- Mỗi danh mục mới lúc cào nhận một mã nhóm đánh giá riêng, dùng chung mọi shop.
-- 888 vẫn là «chưa gán». Nhóm chưa có dòng đánh giá import hiện ở quản trị Đánh giá.

alter table public.messaging_partner_categories
  add column if not exists rating_group_id integer;

create unique index if not exists uq_messaging_partner_categories_rating_group
  on public.messaging_partner_categories (rating_group_id)
  where rating_group_id is not null and rating_group_id > 0;

comment on column public.messaging_partner_categories.rating_group_id is
  'Nhóm đánh giá cấp lúc cào tạo danh mục mới. Một mã cho mọi shop. Không dùng 888/1000.';
