-- W4.1 + W4.2 (docs/PARTNER_WEBSITE_AND_LANDING_UPGRADE_188.md): danh mục sản phẩm per-tenant.
-- Additive-only: KHÔNG đổi schema messaging_partner_inventory hiện có. Shop chưa cấu hình
-- danh mục vẫn dùng /products phẳng như cũ (W4.3) — hai bảng này hoàn toàn mới, không có FK
-- bắt buộc nào từ inventory trỏ ngược lại đây.
--
-- Một nguồn dữ liệu category duy nhất (không tách "product-derived tree" như 188) — xem
-- docs/188_BEHAVIOR_SPEC.md mục A.1 lý do tránh 2 nguồn song song.

create table if not exists public.messaging_partner_categories (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  parent_id uuid references public.messaging_partner_categories (id) on delete cascade,
  name text not null,
  name_i18n jsonb not null default '{}'::jsonb,
  slug text not null,
  path text not null,
  depth int not null default 1,
  sort_order int not null default 0,
  is_active boolean not null default true,
  image_url text not null default '',
  description text not null default '',
  description_i18n jsonb not null default '{}'::jsonb,
  seo_title text not null default '',
  seo_description text not null default '',
  seo_index boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint messaging_partner_categories_no_self_parent check (parent_id is null or parent_id <> id),
  constraint messaging_partner_categories_name_len check (char_length(name) >= 1 and char_length(name) <= 200),
  constraint messaging_partner_categories_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint messaging_partner_categories_slug_len check (char_length(slug) <= 100),
  constraint messaging_partner_categories_path_len check (char_length(path) >= 1 and char_length(path) <= 600),
  constraint messaging_partner_categories_depth_range check (depth >= 1 and depth <= 6)
);

comment on table public.messaging_partner_categories is
  'Cây danh mục sản phẩm theo từng shop (per-tenant), nhiều cấp. Nguồn thật duy nhất cho nav/route/SEO — không suy từ text sản phẩm như 188.';
comment on column public.messaging_partner_categories.path is
  'Full path nối bằng "/" từ slug tổ tiên tới slug hiện tại, vd "ao/ao-thun-nam". Do tầng ứng dụng tính lại khi tạo/di chuyển (W4.4), không phải generated column.';
comment on column public.messaging_partner_categories.name_i18n is
  'Nhãn theo locale, key = mã locale (vi/en/zh/ja/ko). Rỗng = dùng cột name làm mặc định.';

-- Slug không trùng giữa các con cùng cha (coalesce NULL parent về sentinel vì Postgres coi NULL là khác biệt trong unique index).
create unique index if not exists uq_messaging_partner_categories_sibling_slug
  on public.messaging_partner_categories (
    partner_id,
    coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
    slug
  );

-- Full path không trùng trong cùng 1 shop.
create unique index if not exists uq_messaging_partner_categories_partner_path
  on public.messaging_partner_categories (partner_id, path);

create index if not exists idx_messaging_partner_categories_partner_sort
  on public.messaging_partner_categories (partner_id, sort_order);

create index if not exists idx_messaging_partner_categories_parent
  on public.messaging_partner_categories (parent_id);

create index if not exists idx_messaging_partner_categories_partner_active
  on public.messaging_partner_categories (partner_id, is_active);

-- Chặn category cha/con khác partner (an toàn cách ly tenant — không thể enforce bằng check constraint thường vì cần subquery).
create or replace function public.trg_messaging_partner_categories_parent_partner_match()
returns trigger
language plpgsql
as $$
declare
  parent_partner uuid;
begin
  if new.parent_id is not null then
    select partner_id into parent_partner
    from public.messaging_partner_categories
    where id = new.parent_id;

    if parent_partner is null then
      raise exception 'parent_id % không tồn tại', new.parent_id;
    end if;

    if parent_partner <> new.partner_id then
      raise exception 'parent_id phải cùng partner_id với category con';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists tr_messaging_partner_categories_parent_partner_match
  on public.messaging_partner_categories;
create trigger tr_messaging_partner_categories_parent_partner_match
  before insert or update of parent_id, partner_id on public.messaging_partner_categories
  for each row
  execute function public.trg_messaging_partner_categories_parent_partner_match();

create or replace function public.trg_messaging_partner_categories_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tr_messaging_partner_categories_set_updated_at
  on public.messaging_partner_categories;
create trigger tr_messaging_partner_categories_set_updated_at
  before update on public.messaging_partner_categories
  for each row
  execute function public.trg_messaging_partner_categories_set_updated_at();

alter table public.messaging_partner_categories enable row level security;

drop policy if exists "Partner category owners manage own categories." on public.messaging_partner_categories;
create policy "Partner category owners manage own categories." on public.messaging_partner_categories
  for all using (
    exists (
      select 1 from public.messaging_partners p
      where p.id = messaging_partner_categories.partner_id
        and p.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.messaging_partners p
      where p.id = messaging_partner_categories.partner_id
        and p.owner_user_id = auth.uid()
    )
  );

drop policy if exists "Active partner categories are public." on public.messaging_partner_categories;
create policy "Active partner categories are public." on public.messaging_partner_categories
  for select using (is_active = true);

-- W4.2: gắn sản phẩm ↔ danh mục (nhiều-nhiều). Không đổi bảng messaging_partner_inventory.
create table if not exists public.messaging_partner_inventory_categories (
  inventory_id uuid not null references public.messaging_partner_inventory (id) on delete cascade,
  category_id uuid not null references public.messaging_partner_categories (id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (inventory_id, category_id)
);

comment on table public.messaging_partner_inventory_categories is
  'Bảng nối sản phẩm-danh mục (nhiều-nhiều). is_primary=true đánh dấu danh mục chính dùng cho breadcrumb/canonical (tối đa 1/sản phẩm).';

-- Tối đa 1 danh mục chính cho mỗi sản phẩm.
create unique index if not exists uq_messaging_partner_inventory_categories_one_primary
  on public.messaging_partner_inventory_categories (inventory_id)
  where is_primary = true;

create index if not exists idx_messaging_partner_inventory_categories_category
  on public.messaging_partner_inventory_categories (category_id);

-- An toàn cách ly tenant: inventory_id và category_id phải cùng partner_id.
create or replace function public.trg_messaging_partner_inventory_categories_same_partner()
returns trigger
language plpgsql
as $$
declare
  inv_partner uuid;
  cat_partner uuid;
begin
  select partner_id into inv_partner
  from public.messaging_partner_inventory
  where id = new.inventory_id;

  select partner_id into cat_partner
  from public.messaging_partner_categories
  where id = new.category_id;

  if inv_partner is null then
    raise exception 'inventory_id % không tồn tại', new.inventory_id;
  end if;

  if cat_partner is null then
    raise exception 'category_id % không tồn tại', new.category_id;
  end if;

  if inv_partner <> cat_partner then
    raise exception 'inventory_id và category_id phải cùng partner_id';
  end if;

  return new;
end;
$$;

drop trigger if exists tr_messaging_partner_inventory_categories_same_partner
  on public.messaging_partner_inventory_categories;
create trigger tr_messaging_partner_inventory_categories_same_partner
  before insert or update on public.messaging_partner_inventory_categories
  for each row
  execute function public.trg_messaging_partner_inventory_categories_same_partner();

alter table public.messaging_partner_inventory_categories enable row level security;

drop policy if exists "Partner inventory category owners manage own links." on public.messaging_partner_inventory_categories;
create policy "Partner inventory category owners manage own links." on public.messaging_partner_inventory_categories
  for all using (
    exists (
      select 1 from public.messaging_partner_inventory inv
      join public.messaging_partners p on p.id = inv.partner_id
      where inv.id = messaging_partner_inventory_categories.inventory_id
        and p.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.messaging_partner_inventory inv
      join public.messaging_partners p on p.id = inv.partner_id
      where inv.id = messaging_partner_inventory_categories.inventory_id
        and p.owner_user_id = auth.uid()
    )
  );

drop policy if exists "Inventory category links are public read." on public.messaging_partner_inventory_categories;
create policy "Inventory category links are public read." on public.messaging_partner_inventory_categories
  for select using (true);
