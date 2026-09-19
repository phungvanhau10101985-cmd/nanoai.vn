-- Import cây danh mục taxonomy giống 188.com.vn (`taxonomy_import.xlsx`, 4 sheet).
-- Additive: gắn `external_id` để upsert lặp lại; lưu SEO cluster theo partner (metadata).
-- Storefront vẫn dùng `/c/{l1}/{l2}/{l3}` — không copy cluster 301 `/c/{slug}`.

create table if not exists public.messaging_partner_seo_clusters (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  external_id text not null,
  slug text not null,
  name text not null,
  canonical_path text not null,
  index_policy text not null default 'index',
  source text not null default 'auto_from_cat3',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint messaging_partner_seo_clusters_external_len check (char_length(external_id) >= 1 and char_length(external_id) <= 200),
  constraint messaging_partner_seo_clusters_slug_len check (char_length(slug) >= 1 and char_length(slug) <= 300),
  constraint messaging_partner_seo_clusters_name_len check (char_length(name) >= 1 and char_length(name) <= 500),
  constraint messaging_partner_seo_clusters_path_len check (char_length(canonical_path) >= 1 and char_length(canonical_path) <= 500),
  constraint messaging_partner_seo_clusters_index_policy check (index_policy in ('index', 'noindex'))
);

comment on table public.messaging_partner_seo_clusters is
  'SEO cluster theo shop — khớp sheet seo_clusters của taxonomy_import.xlsx (188). Không đổi route storefront.';

create unique index if not exists uq_messaging_partner_seo_clusters_partner_external
  on public.messaging_partner_seo_clusters (partner_id, external_id);

create unique index if not exists uq_messaging_partner_seo_clusters_partner_slug
  on public.messaging_partner_seo_clusters (partner_id, slug);

create index if not exists idx_messaging_partner_seo_clusters_partner
  on public.messaging_partner_seo_clusters (partner_id);

alter table public.messaging_partner_categories
  add column if not exists external_id text,
  add column if not exists seo_cluster_id uuid;

comment on column public.messaging_partner_categories.external_id is
  'id chuỗi từ taxonomy_import.xlsx (vd cat3__giay-dep-nu__…) — khóa upsert khi re-import.';
comment on column public.messaging_partner_categories.seo_cluster_id is
  'Cluster SEO gắn cat3 (metadata import 188). Storefront không 301 về /c/{cluster-slug}.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'messaging_partner_categories_seo_cluster_fk'
  ) then
    alter table public.messaging_partner_categories
      add constraint messaging_partner_categories_seo_cluster_fk
      foreign key (seo_cluster_id)
      references public.messaging_partner_seo_clusters (id)
      on delete set null;
  end if;
end
$$;

create unique index if not exists uq_messaging_partner_categories_partner_external
  on public.messaging_partner_categories (partner_id, external_id)
  where external_id is not null and char_length(btrim(external_id)) > 0;

create index if not exists idx_messaging_partner_categories_seo_cluster
  on public.messaging_partner_categories (seo_cluster_id);

alter table public.messaging_partner_seo_clusters enable row level security;

drop policy if exists "Partner seo cluster owners manage own clusters." on public.messaging_partner_seo_clusters;
create policy "Partner seo cluster owners manage own clusters." on public.messaging_partner_seo_clusters
  for all using (
    exists (
      select 1 from public.messaging_partners p
      where p.id = messaging_partner_seo_clusters.partner_id
        and p.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.messaging_partners p
      where p.id = messaging_partner_seo_clusters.partner_id
        and p.owner_user_id = auth.uid()
    )
  );

drop policy if exists "Active partner seo clusters are public." on public.messaging_partner_seo_clusters;
create policy "Active partner seo clusters are public." on public.messaging_partner_seo_clusters
  for select using (true);
