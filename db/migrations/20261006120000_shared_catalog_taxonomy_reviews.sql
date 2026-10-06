-- Cây danh mục, cụm SEO, pool đánh giá ảo và pool hỏi đáp ảo dùng chung mọi shop.
-- Gán sản phẩm, đánh giá khách mua thật, đơn hàng vẫn theo partner_id.
-- Gộp bản trùng (external_id rồi path), rồi khóa unique toàn cục.

drop trigger if exists tr_messaging_partner_inventory_categories_same_partner
  on public.messaging_partner_inventory_categories;

drop trigger if exists tr_messaging_partner_categories_parent_partner_match
  on public.messaging_partner_categories;

-- ---------------------------------------------------------------------------
-- SEO cluster: một external_id = một dòng
-- ---------------------------------------------------------------------------
create temp table _shared_cluster_rank on commit drop as
select
  s.id,
  s.external_id,
  row_number() over (
    partition by s.external_id
    order by
      (select count(*) from public.messaging_partner_categories c where c.seo_cluster_id = s.id) desc,
      s.created_at asc,
      s.id::text asc
  ) as rn
from public.messaging_partner_seo_clusters s;

update public.messaging_partner_categories c
set seo_cluster_id = keep.id
from _shared_cluster_rank drop_row
join _shared_cluster_rank keep
  on keep.external_id = drop_row.external_id
 and keep.rn = 1
where drop_row.rn > 1
  and c.seo_cluster_id = drop_row.id;

delete from public.messaging_partner_seo_clusters s
using _shared_cluster_rank r
where s.id = r.id
  and r.rn > 1;

drop index if exists public.uq_messaging_partner_seo_clusters_partner_external;
drop index if exists public.uq_messaging_partner_seo_clusters_partner_slug;

create unique index if not exists uq_messaging_partner_seo_clusters_external
  on public.messaging_partner_seo_clusters (external_id);

create index if not exists idx_messaging_partner_seo_clusters_slug
  on public.messaging_partner_seo_clusters (slug);

-- ---------------------------------------------------------------------------
-- Danh mục: gộp theo external_id, rồi theo path
-- ---------------------------------------------------------------------------
create temp table _shared_cat_ext on commit drop as
select
  c.id,
  btrim(c.external_id) as external_id,
  row_number() over (
    partition by btrim(c.external_id)
    order by
      (select count(*) from public.messaging_partner_inventory_categories pic where pic.category_id = c.id) desc,
      (case when coalesce(c.seo_title, '') <> '' or coalesce(c.seo_body, '') <> '' then 1 else 0 end) desc,
      c.created_at asc,
      c.id::text asc
  ) as rn
from public.messaging_partner_categories c
where nullif(btrim(coalesce(c.external_id, '')), '') is not null;

delete from public.messaging_partner_inventory_categories pic
using _shared_cat_ext drop_row
join _shared_cat_ext keep
  on keep.external_id = drop_row.external_id
 and keep.rn = 1
where drop_row.rn > 1
  and pic.category_id = drop_row.id
  and exists (
    select 1
    from public.messaging_partner_inventory_categories pic2
    where pic2.inventory_id = pic.inventory_id
      and pic2.category_id = keep.id
  );

update public.messaging_partner_inventory_categories pic
set category_id = keep.id
from _shared_cat_ext drop_row
join _shared_cat_ext keep
  on keep.external_id = drop_row.external_id
 and keep.rn = 1
where drop_row.rn > 1
  and pic.category_id = drop_row.id;

update public.messaging_partner_categories child
set parent_id = keep.id
from _shared_cat_ext drop_row
join _shared_cat_ext keep
  on keep.external_id = drop_row.external_id
 and keep.rn = 1
where drop_row.rn > 1
  and child.parent_id = drop_row.id
  and child.id <> keep.id;

update public.messaging_partner_search_aliases a
set category_id = keep.id
from _shared_cat_ext drop_row
join _shared_cat_ext keep
  on keep.external_id = drop_row.external_id
 and keep.rn = 1
where drop_row.rn > 1
  and a.category_id = drop_row.id;

update public.messaging_partner_promotions p
set category_id = keep.id
from _shared_cat_ext drop_row
join _shared_cat_ext keep
  on keep.external_id = drop_row.external_id
 and keep.rn = 1
where drop_row.rn > 1
  and p.category_id = drop_row.id;

update public.messaging_partner_landing_pages lp
set category_id = keep.id
from _shared_cat_ext drop_row
join _shared_cat_ext keep
  on keep.external_id = drop_row.external_id
 and keep.rn = 1
where drop_row.rn > 1
  and lp.category_id = drop_row.id;

delete from public.messaging_partner_categories c
using _shared_cat_ext r
where c.id = r.id
  and r.rn > 1;

create temp table _shared_cat_path on commit drop as
select
  c.id,
  c.path,
  row_number() over (
    partition by c.path
    order by
      (case when nullif(btrim(coalesce(c.external_id, '')), '') is not null then 1 else 0 end) desc,
      (select count(*) from public.messaging_partner_inventory_categories pic where pic.category_id = c.id) desc,
      (case when coalesce(c.seo_title, '') <> '' or coalesce(c.seo_body, '') <> '' then 1 else 0 end) desc,
      c.created_at asc,
      c.id::text asc
  ) as rn
from public.messaging_partner_categories c;

delete from public.messaging_partner_inventory_categories pic
using _shared_cat_path drop_row
join _shared_cat_path keep
  on keep.path = drop_row.path
 and keep.rn = 1
where drop_row.rn > 1
  and pic.category_id = drop_row.id
  and exists (
    select 1
    from public.messaging_partner_inventory_categories pic2
    where pic2.inventory_id = pic.inventory_id
      and pic2.category_id = keep.id
  );

update public.messaging_partner_inventory_categories pic
set category_id = keep.id
from _shared_cat_path drop_row
join _shared_cat_path keep
  on keep.path = drop_row.path
 and keep.rn = 1
where drop_row.rn > 1
  and pic.category_id = drop_row.id;

update public.messaging_partner_categories child
set parent_id = keep.id
from _shared_cat_path drop_row
join _shared_cat_path keep
  on keep.path = drop_row.path
 and keep.rn = 1
where drop_row.rn > 1
  and child.parent_id = drop_row.id
  and child.id <> keep.id;

update public.messaging_partner_search_aliases a
set category_id = keep.id
from _shared_cat_path drop_row
join _shared_cat_path keep
  on keep.path = drop_row.path
 and keep.rn = 1
where drop_row.rn > 1
  and a.category_id = drop_row.id;

update public.messaging_partner_promotions p
set category_id = keep.id
from _shared_cat_path drop_row
join _shared_cat_path keep
  on keep.path = drop_row.path
 and keep.rn = 1
where drop_row.rn > 1
  and p.category_id = drop_row.id;

update public.messaging_partner_landing_pages lp
set category_id = keep.id
from _shared_cat_path drop_row
join _shared_cat_path keep
  on keep.path = drop_row.path
 and keep.rn = 1
where drop_row.rn > 1
  and lp.category_id = drop_row.id;

delete from public.messaging_partner_categories c
using _shared_cat_path r
where c.id = r.id
  and r.rn > 1;

-- Hai nhánh cùng cha + cùng slug (path khác nhau) gộp trước unique.
create or replace function public._shared_catalog_fold_category(drop_id uuid, keep_id uuid)
returns void
language plpgsql
as $$
begin
  if drop_id is null or keep_id is null or drop_id = keep_id then
    return;
  end if;

  delete from public.messaging_partner_inventory_categories pic
  where pic.category_id = drop_id
    and exists (
      select 1
      from public.messaging_partner_inventory_categories pic2
      where pic2.inventory_id = pic.inventory_id
        and pic2.category_id = keep_id
    );

  update public.messaging_partner_inventory_categories
  set category_id = keep_id
  where category_id = drop_id;

  update public.messaging_partner_categories
  set parent_id = keep_id
  where parent_id = drop_id
    and id <> keep_id;

  update public.messaging_partner_search_aliases
  set category_id = keep_id
  where category_id = drop_id;

  update public.messaging_partner_promotions
  set category_id = keep_id
  where category_id = drop_id;

  update public.messaging_partner_landing_pages
  set category_id = keep_id
  where category_id = drop_id;

  delete from public.messaging_partner_categories where id = drop_id;
end;
$$;

do $$
declare
  drop_id uuid;
  keep_id uuid;
  guard int := 0;
begin
  loop
    guard := guard + 1;
    if guard > 12 then
      raise exception 'shared catalog sibling slug still collides after 12 passes';
    end if;

    select s.drop_id, s.keep_id
      into drop_id, keep_id
    from (
      select
        c.id as drop_id,
        first_value(c.id) over (
          partition by coalesce(c.parent_id, '00000000-0000-0000-0000-000000000000'::uuid), c.slug
          order by
            (select count(*) from public.messaging_partner_inventory_categories pic where pic.category_id = c.id) desc,
            (case when coalesce(c.seo_title, '') <> '' or coalesce(c.seo_body, '') <> '' then 1 else 0 end) desc,
            c.created_at asc,
            c.id::text asc
        ) as keep_id,
        row_number() over (
          partition by coalesce(c.parent_id, '00000000-0000-0000-0000-000000000000'::uuid), c.slug
          order by
            (select count(*) from public.messaging_partner_inventory_categories pic where pic.category_id = c.id) desc,
            (case when coalesce(c.seo_title, '') <> '' or coalesce(c.seo_body, '') <> '' then 1 else 0 end) desc,
            c.created_at asc,
            c.id::text asc
        ) as rn
      from public.messaging_partner_categories c
    ) s
    where s.rn > 1
    limit 1;

    exit when not found;
    perform public._shared_catalog_fold_category(drop_id, keep_id);
  end loop;
end;
$$;

drop function public._shared_catalog_fold_category(uuid, uuid);

drop index if exists public.uq_messaging_partner_categories_sibling_slug;
drop index if exists public.uq_messaging_partner_categories_partner_path;
drop index if exists public.uq_messaging_partner_categories_partner_external;

create unique index if not exists uq_messaging_partner_categories_path
  on public.messaging_partner_categories (path);

create unique index if not exists uq_messaging_partner_categories_external
  on public.messaging_partner_categories (external_id)
  where external_id is not null and char_length(btrim(external_id)) > 0;

create unique index if not exists uq_messaging_partner_categories_sibling_slug
  on public.messaging_partner_categories (
    coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
    slug
  );

comment on table public.messaging_partner_categories is
  'Cây danh mục dùng chung mọi shop. partner_id chỉ là shop ghi dòng. Gán sản phẩm vẫn theo từng kho.';
comment on table public.messaging_partner_seo_clusters is
  'SEO cluster dùng chung mọi shop — metadata taxonomy_import.xlsx. Không đổi route storefront.';

-- ---------------------------------------------------------------------------
-- Pool đánh giá / hỏi đáp ảo: bỏ bản trùng nội dung
-- ---------------------------------------------------------------------------
delete from public.messaging_partner_product_reviews r
using (
  select
    id,
    row_number() over (
      partition by import_group, lower(btrim(content)), lower(btrim(reviewer_name))
      order by created_at asc, id::text asc
    ) as rn
  from public.messaging_partner_product_reviews
  where is_imported = true
) d
where r.id = d.id
  and d.rn > 1;

delete from public.messaging_partner_product_questions q
using (
  select
    id,
    row_number() over (
      partition by import_group, lower(btrim(content)), lower(btrim(asker_name))
      order by created_at asc, id::text asc
    ) as rn
  from public.messaging_partner_product_questions
  where is_imported = true
) d
where q.id = d.id
  and d.rn > 1;

create index if not exists idx_messaging_partner_product_reviews_shared_import
  on public.messaging_partner_product_reviews (import_group)
  where is_imported = true and is_active = true;

create index if not exists idx_messaging_partner_product_questions_shared_import
  on public.messaging_partner_product_questions (import_group)
  where is_imported = true and is_active = true;

-- Xóa shop không được xóa cây chung / pool ảo. Chuyển partner_id sang shop còn lại.
create or replace function public.trg_reassign_shared_catalog_before_partner_delete()
returns trigger
language plpgsql
as $$
declare
  heir uuid;
begin
  select id into heir
  from public.messaging_partners
  where id <> old.id
  order by created_at asc
  limit 1;

  if heir is null then
    return old;
  end if;

  update public.messaging_partner_categories
  set partner_id = heir
  where partner_id = old.id;

  update public.messaging_partner_seo_clusters
  set partner_id = heir
  where partner_id = old.id;

  update public.messaging_partner_product_question_answers a
  set partner_id = heir
  from public.messaging_partner_product_questions q
  where a.question_id = q.id
    and q.is_imported = true
    and a.partner_id = old.id;

  update public.messaging_partner_product_reviews
  set partner_id = heir
  where partner_id = old.id
    and is_imported = true;

  update public.messaging_partner_product_questions
  set partner_id = heir
  where partner_id = old.id
    and is_imported = true;

  return old;
end;
$$;

drop trigger if exists tr_reassign_shared_catalog_before_partner_delete
  on public.messaging_partners;
create trigger tr_reassign_shared_catalog_before_partner_delete
  before delete on public.messaging_partners
  for each row
  execute function public.trg_reassign_shared_catalog_before_partner_delete();
