-- Bộ ảnh bán hàng cho tài khoản không có web shop SaaS.
-- Cùng payload/studio với Product Studio AI, không ghi tồn kho và không tạo danh mục shop.

create table if not exists public.user_catalog_photo_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  mode text not null default 'ai' check (mode = 'ai'),
  status text not null default 'draft'
    check (status in ('draft', 'generating', 'ready_for_review', 'publishing', 'done', 'failed')),
  step text null,
  message text null,
  progress int not null default 0 check (progress >= 0 and progress <= 100),
  payload jsonb not null default '{}'::jsonb,
  studio jsonb not null default '{}'::jsonb,
  vision_product_name text null,
  vision_analysis text null,
  vision_colors jsonb not null default '[]'::jsonb,
  result jsonb null,
  error_message text null,
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.user_catalog_photo_jobs is
  'Bộ ảnh catalog từ ảnh tự chụp. Chỉ trả tên, loại và ảnh — không đăng lên web shop.';

create index if not exists idx_user_catalog_photo_jobs_user_created
  on public.user_catalog_photo_jobs (user_id, created_at desc);

create or replace function public.trg_user_catalog_photo_jobs_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tr_user_catalog_photo_jobs_set_updated_at on public.user_catalog_photo_jobs;
create trigger tr_user_catalog_photo_jobs_set_updated_at
  before update on public.user_catalog_photo_jobs
  for each row
  execute function public.trg_user_catalog_photo_jobs_set_updated_at();

alter table public.user_catalog_photo_jobs enable row level security;

drop policy if exists "Users manage own catalog photo jobs." on public.user_catalog_photo_jobs;
create policy "Users manage own catalog photo jobs." on public.user_catalog_photo_jobs
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());
