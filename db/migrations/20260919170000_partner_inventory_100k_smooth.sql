-- Catalog 100k smoothness: btree_gin (partner_id, search_document), PG L2 id-list (cat/shop).
-- Additive. Mọi shop SaaS cùng engine — không khóa slug.

create extension if not exists btree_gin;

create index if not exists idx_mpi_partner_search_document_trgm
  on public.messaging_partner_inventory using gin (partner_id, search_document gin_trgm_ops);

drop index if exists public.idx_mpi_search_document_trgm;

create table if not exists public.messaging_partner_listing_id_cache (
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  scope_type text not null
    check (scope_type in ('category', 'shop')),
  scope_key text not null,
  cache_ver int not null default 0,
  ids_json jsonb not null default '[]'::jsonb,
  product_count int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (partner_id, scope_type, scope_key)
);

create index if not exists idx_partner_listing_id_cache_ver
  on public.messaging_partner_listing_id_cache (partner_id, cache_ver);

comment on table public.messaging_partner_listing_id_cache is
  'Id list listing danh mục / catalog shop (tối đa 5000 UUID). Redis L1; cache_ver khớp bumpInventoryCache. Không lưu q tìm chữ.';

alter table public.messaging_partner_listing_id_cache enable row level security;
