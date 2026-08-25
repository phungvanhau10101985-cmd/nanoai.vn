-- Catalog sản phẩm khớp Excel 188.com.vn (~41 cột). Additive — không đổi nghĩa cột cũ.
-- `origin` hiện có = nguồn tạo dòng (manual|manual_ai|import|chat).
-- `source_origin` = xuất xứ hàng (1688, taobao, manual…) — cột Excel `origin` bên 188.

alter table public.messaging_partner_inventory
  add column if not exists catalog_json jsonb null,
  add column if not exists brand_name text null,
  add column if not exists source_origin text null,
  add column if not exists chinese_name text null,
  add column if not exists deposit_required boolean not null default false,
  add column if not exists category_l1 text null,
  add column if not exists category_l2 text null,
  add column if not exists category_l3 text null,
  add column if not exists likes_count integer not null default 0,
  add column if not exists purchases_count integer not null default 0,
  add column if not exists reviews_count integer not null default 0,
  add column if not exists questions_count integer not null default 0,
  add column if not exists rating_score numeric(8, 2) not null default 0,
  add column if not exists catalog_slug text null,
  add column if not exists style text null,
  add column if not exists color_summary text null,
  add column if not exists occasion text null,
  add column if not exists weight text null,
  add column if not exists features_json jsonb null,
  add column if not exists product_info_json jsonb null,
  add column if not exists source_shop_name text null,
  add column if not exists source_shop_id text null,
  add column if not exists source_shop_name_chinese text null,
  add column if not exists price_low_hint text null,
  add column if not exists price_high_hint text null,
  add column if not exists rating_group_id integer null,
  add column if not exists question_group_id integer null;

comment on column public.messaging_partner_inventory.catalog_json is
  'Snapshot dict sản phẩm khớp excel_row_to_product 188 (product_id, colors, product_info…). Dùng để xuất Excel round-trip.';
comment on column public.messaging_partner_inventory.source_origin is
  'Xuất xứ hàng (cột Excel origin bên 188). Không trộn với origin = nguồn tạo dòng SaaS.';
comment on column public.messaging_partner_inventory.deposit_required is
  'Cột Excel deposit_required. File 188: ô trống = cần cọc.';
comment on column public.messaging_partner_inventory.category_l1 is
  'Danh mục cấp 1 (Excel Main Category) — đồng thời gán vào cây messaging_partner_categories khi import.';

create index if not exists idx_mpi_partner_remarketing
  on public.messaging_partner_inventory (partner_id, remarketing_id)
  where coalesce(trim(remarketing_id), '') <> '';

create index if not exists idx_mpi_partner_brand
  on public.messaging_partner_inventory (partner_id, brand_name)
  where coalesce(trim(brand_name), '') <> '';
