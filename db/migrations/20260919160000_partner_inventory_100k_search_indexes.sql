-- Catalog 100k / tenant: search_document + GIN trigram, listing indexes, facet snapshot.
-- Additive. Mọi shop SaaS cùng engine — không khóa slug.

create extension if not exists pg_trgm;
create extension if not exists unaccent;

alter table public.messaging_partner_inventory
  add column if not exists search_document text not null default '';

comment on column public.messaging_partner_inventory.search_document is
  'Haystack tìm chữ (không mô tả). Trigger ghi lúc INSERT/UPDATE; GIN pg_trgm cho ILIKE %từ%.';

create or replace function public.partner_inventory_build_search_document(
  p_name text,
  p_catalog_slug text,
  p_sku text,
  p_remarketing_id text,
  p_category_l1 text,
  p_category_l2 text,
  p_category_l3 text,
  p_material_note text,
  p_style text,
  p_color_summary text,
  p_occasion text,
  p_features_json jsonb,
  p_sizes_json jsonb,
  p_product_info_json jsonb,
  p_catalog_json jsonb
) returns text
language sql
immutable
as $$
  select lower(concat_ws(
    ' ',
    coalesce(p_name, ''),
    coalesce(p_catalog_slug, ''),
    coalesce(p_sku, ''),
    coalesce(p_remarketing_id, ''),
    coalesce(p_category_l1, ''),
    coalesce(p_category_l2, ''),
    coalesce(p_category_l3, ''),
    coalesce(p_material_note, ''),
    coalesce(p_style, ''),
    coalesce(p_color_summary, ''),
    coalesce(p_occasion, ''),
    coalesce(p_features_json::text, ''),
    coalesce(p_sizes_json::text, ''),
    coalesce(p_product_info_json::text, ''),
    coalesce(p_catalog_json->>'category', ''),
    coalesce(p_catalog_json->>'subcategory', ''),
    coalesce(p_catalog_json->>'sub_subcategory', ''),
    coalesce(p_catalog_json->>'material', ''),
    coalesce(p_catalog_json->>'style', ''),
    coalesce(p_catalog_json->>'color', ''),
    coalesce(p_catalog_json->>'occasion', ''),
    coalesce(p_catalog_json->>'code', ''),
    coalesce(p_catalog_json->>'slug', ''),
    coalesce(p_catalog_json->>'features', ''),
    coalesce(p_catalog_json->>'sizes', ''),
    coalesce(p_catalog_json->>'product_info', '')
  ));
$$;

create or replace function public.trg_partner_inventory_search_document()
returns trigger
language plpgsql
as $$
begin
  new.search_document := public.partner_inventory_build_search_document(
    new.name,
    new.catalog_slug,
    new.sku,
    new.remarketing_id,
    new.category_l1,
    new.category_l2,
    new.category_l3,
    new.material_note,
    new.style,
    new.color_summary,
    new.occasion,
    new.features_json,
    new.sizes_json,
    new.product_info_json,
    new.catalog_json
  );
  return new;
end;
$$;

drop trigger if exists trg_partner_inventory_search_document on public.messaging_partner_inventory;
create trigger trg_partner_inventory_search_document
before insert or update of
  name, catalog_slug, sku, remarketing_id,
  category_l1, category_l2, category_l3, material_note,
  style, color_summary, occasion, features_json, sizes_json,
  product_info_json, catalog_json
on public.messaging_partner_inventory
for each row
execute function public.trg_partner_inventory_search_document();

update public.messaging_partner_inventory
set search_document = public.partner_inventory_build_search_document(
  name, catalog_slug, sku, remarketing_id,
  category_l1, category_l2, category_l3, material_note,
  style, color_summary, occasion, features_json, sizes_json,
  product_info_json, catalog_json
)
where coalesce(search_document, '') = '';

create index if not exists idx_mpi_search_document_trgm
  on public.messaging_partner_inventory using gin (search_document gin_trgm_ops);

create index if not exists idx_mpi_partner_active_id
  on public.messaging_partner_inventory (partner_id, id)
  where coalesce(is_active, true) = true;

create index if not exists idx_mpi_partner_active_created
  on public.messaging_partner_inventory (partner_id, created_at desc)
  where coalesce(is_active, true) = true;

create index if not exists idx_mpi_partner_active_price
  on public.messaging_partner_inventory (partner_id, price_amount)
  where coalesce(is_active, true) = true and price_amount is not null;

create index if not exists idx_mpi_sizes_json_gin
  on public.messaging_partner_inventory using gin (sizes_json)
  where sizes_json is not null;

create index if not exists idx_mpi_colors_json_gin
  on public.messaging_partner_inventory using gin (colors_json)
  where colors_json is not null;

create index if not exists idx_mpc_partner_active_sort
  on public.messaging_partner_categories (partner_id, depth, sort_order, name)
  where is_active = true;

create index if not exists idx_mpc_partner_path
  on public.messaging_partner_categories (partner_id, path);

create index if not exists idx_mpic_category_inventory
  on public.messaging_partner_inventory_categories (category_id, inventory_id);

create table if not exists public.messaging_partner_listing_facet_cache (
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  scope_type text not null
    check (scope_type in ('category', 'search_q')),
  scope_key text not null,
  cache_ver int not null default 0,
  sizes_json jsonb not null default '[]'::jsonb,
  colors_json jsonb not null default '[]'::jsonb,
  style_tags_json jsonb not null default '[]'::jsonb,
  price_min numeric null,
  price_max numeric null,
  product_count int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (partner_id, scope_type, scope_key)
);

create index if not exists idx_partner_listing_facet_cache_ver
  on public.messaging_partner_listing_facet_cache (partner_id, cache_ver);

comment on table public.messaging_partner_listing_facet_cache is
  'Snapshot facet gốc (size/màu/kiểu/giá/count) theo partner_id. Redis L1; cache_ver khớp bumpInventoryCache.';

alter table public.messaging_partner_listing_facet_cache enable row level security;
