-- W3.3 + W3.4 (docs/PARTNER_WEBSITE_AND_LANDING_UPGRADE_188.md): CMS trang tĩnh + SEO tự chỉnh theo
-- từng shop. 2 công dụng trong 1 bảng:
--   1) Ghi đè nội dung/SEO của 8 trang có sẵn (about/contact/faq/sale/shipping/returns/privacy/terms)
--      — `slug` trùng 1 trong 8 key này. Nếu KHÔNG có dòng nào (hoặc is_published=false) thì trang
--      công khai vẫn dùng nội dung mặc định hardcode (100% tương thích ngược, không đổi hành vi cũ).
--   2) Trang tự do mới do merchant tạo — `slug` bất kỳ khác 8 key trên, hiện tại `/site/{slug}/pages/{slug}`.
-- Nội dung 1 NGÔN NGỮ duy nhất theo `locale` của chính shop đó (mỗi shop 1 ngôn ngữ cố định, khác
-- platform UI đa ngôn ngữ — xem messaging_partner_websites.locale).
create table if not exists public.messaging_partner_static_pages (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  slug text not null,
  title text not null,
  content text not null default '',
  seo_title text not null default '',
  seo_description text not null default '',
  seo_index boolean not null default true,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint messaging_partner_static_pages_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint messaging_partner_static_pages_slug_len check (char_length(slug) between 1 and 80),
  constraint messaging_partner_static_pages_title_len check (char_length(title) between 1 and 200)
);

comment on table public.messaging_partner_static_pages is
  'CMS trang tĩnh theo shop (W3.4) — ghi đè 8 trang có sẵn (slug trùng key mặc định) hoặc tạo trang mới tự do (/site/{slug}/pages/{slug}). SEO per-page tự chỉnh (W3.3).';

create unique index if not exists uq_messaging_partner_static_pages_partner_slug
  on public.messaging_partner_static_pages (partner_id, slug);

create index if not exists idx_messaging_partner_static_pages_partner_published
  on public.messaging_partner_static_pages (partner_id, is_published);

create or replace function public.trg_messaging_partner_static_pages_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tr_messaging_partner_static_pages_set_updated_at on public.messaging_partner_static_pages;
create trigger tr_messaging_partner_static_pages_set_updated_at
  before update on public.messaging_partner_static_pages
  for each row
  execute function public.trg_messaging_partner_static_pages_set_updated_at();

alter table public.messaging_partner_static_pages enable row level security;

drop policy if exists "Partner static page owners manage own pages." on public.messaging_partner_static_pages;
create policy "Partner static page owners manage own pages." on public.messaging_partner_static_pages
  for all using (
    exists (
      select 1 from public.messaging_partners p
      where p.id = messaging_partner_static_pages.partner_id and p.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.messaging_partners p
      where p.id = messaging_partner_static_pages.partner_id and p.owner_user_id = auth.uid()
    )
  );

drop policy if exists "Published static pages are public." on public.messaging_partner_static_pages;
create policy "Published static pages are public." on public.messaging_partner_static_pages
  for select using (is_published = true);
