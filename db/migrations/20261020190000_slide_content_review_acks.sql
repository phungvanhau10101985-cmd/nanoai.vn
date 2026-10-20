-- Số giáo viên xác nhận đúng và số lần sửa từng slide giáo trình (bản chung).
-- Sau một lần sửa, 7 giáo viên khác xác nhận đúng nội dung vừa sửa thì hết cảnh báo.

create table if not exists public.worksheet_slide_content_reviews (
  id bigserial primary key,
  curriculum_id uuid not null references public.worksheet_curricula(id) on delete cascade,
  lesson_no int not null check (lesson_no > 0),
  slide_index int not null check (slide_index >= 0),
  content_hash text not null,
  user_id uuid not null,
  action text not null check (action in ('confirm', 'edit')),
  created_at timestamptz not null default now()
);

create index if not exists idx_slide_content_reviews_lookup
  on public.worksheet_slide_content_reviews (curriculum_id, lesson_no, slide_index, created_at);

create unique index if not exists idx_slide_content_reviews_confirm_once
  on public.worksheet_slide_content_reviews (curriculum_id, lesson_no, slide_index, content_hash, user_id)
  where action = 'confirm';

alter table public.worksheet_slide_content_reviews enable row level security;

drop policy if exists "Authenticated users can view slide content reviews" on public.worksheet_slide_content_reviews;
create policy "Authenticated users can view slide content reviews"
  on public.worksheet_slide_content_reviews for select
  using (auth.uid() is not null);

comment on table public.worksheet_slide_content_reviews is
  'Giáo viên xác nhận hoặc sửa một slide. Cảnh báo đọc kỹ tắt sau 7 giáo viên khác xác nhận bản vừa sửa.';
