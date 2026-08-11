-- L3.1 (docs/PARTNER_WEBSITE_AND_LANDING_UPGRADE_188.md — Ladipage AI): section cố định
-- (hero/highlights/material/products_grid/trust_cta/faq), luôn dựa trên sản phẩm/danh mục THẬT
-- resolve live — không lưu snapshot tên/giá/ảnh. Additive-only cạnh bảng landing hiện có.

alter table public.messaging_partner_landing_pages
  add column if not exists source_type text not null default 'products',
  add column if not exists category_id uuid null references public.messaging_partner_categories (id) on delete set null,
  add column if not exists products_limit int null default 12,
  add column if not exists material_filter text null,
  add column if not exists meta_title text null,
  add column if not exists meta_description text null;

alter table public.messaging_partner_landing_pages
  drop constraint if exists messaging_partner_landing_pages_source_type_check;
alter table public.messaging_partner_landing_pages
  add constraint messaging_partner_landing_pages_source_type_check
  check (source_type in ('products', 'category'));

comment on column public.messaging_partner_landing_pages.source_type is
  'L3.2 — products (1-8 SP admin chọn, hành vi cũ) | category (top N sản phẩm live theo category_id).';
comment on column public.messaging_partner_landing_pages.category_id is
  'L3.2 — chỉ có nghĩa khi source_type=category. Sản phẩm luôn resolve live tại thời điểm render/generate — không snapshot.';
comment on column public.messaging_partner_landing_pages.material_filter is
  'L3.2 — lọc chất liệu/màu khi source_type=category (industry facet adapter W4.11 — chỉ áp dụng ngành có facet material/color).';

-- L3.1 — section cố định cho mỗi landing (hero/highlights/material/products_grid/trust_cta/faq).
create table if not exists public.messaging_partner_landing_sections (
  id uuid primary key default gen_random_uuid(),
  landing_id uuid not null references public.messaging_partner_landing_pages (id) on delete cascade,
  section_type text not null
    check (section_type in ('hero', 'highlights', 'material', 'products_grid', 'trust_cta', 'faq')),
  order_index int not null default 0,
  status text not null default 'pending' check (status in ('pending', 'generating', 'ready', 'error')),
  data jsonb not null default '{}'::jsonb,
  prompt_used text null,
  error_message text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.messaging_partner_landing_sections is
  'L3.1 — nội dung AI sinh theo section cố định cho 1 landing. products_grid không phải nội dung AI (luôn render live).';

create unique index if not exists uq_messaging_partner_landing_sections_landing_type
  on public.messaging_partner_landing_sections (landing_id, section_type);

create index if not exists idx_messaging_partner_landing_sections_landing_order
  on public.messaging_partner_landing_sections (landing_id, order_index);

create or replace function public.trg_messaging_partner_landing_sections_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tr_messaging_partner_landing_sections_set_updated_at
  on public.messaging_partner_landing_sections;
create trigger tr_messaging_partner_landing_sections_set_updated_at
  before update on public.messaging_partner_landing_sections
  for each row
  execute function public.trg_messaging_partner_landing_sections_set_updated_at();

alter table public.messaging_partner_landing_sections enable row level security;

drop policy if exists "Partner landing section owners manage own sections." on public.messaging_partner_landing_sections;
create policy "Partner landing section owners manage own sections." on public.messaging_partner_landing_sections
  for all using (
    exists (
      select 1 from public.messaging_partner_landing_pages lp
      join public.messaging_partners p on p.id = lp.partner_id
      where lp.id = messaging_partner_landing_sections.landing_id
        and p.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.messaging_partner_landing_pages lp
      join public.messaging_partners p on p.id = lp.partner_id
      where lp.id = messaging_partner_landing_sections.landing_id
        and p.owner_user_id = auth.uid()
    )
  );

drop policy if exists "Published landing sections are public read." on public.messaging_partner_landing_sections;
create policy "Published landing sections are public read." on public.messaging_partner_landing_sections
  for select using (
    exists (
      select 1 from public.messaging_partner_landing_pages lp
      where lp.id = messaging_partner_landing_sections.landing_id
        and lp.is_published = true
    )
  );
