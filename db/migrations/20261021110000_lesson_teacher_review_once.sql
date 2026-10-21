-- Mỗi giáo viên chỉ cần duyệt một tiết một lần. Lần sau mở thẳng giao diện học sinh.

create table if not exists public.worksheet_lesson_teacher_reviews (
  curriculum_id uuid not null references public.worksheet_curricula(id) on delete cascade,
  lesson_no int not null check (lesson_no > 0),
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (curriculum_id, lesson_no, user_id)
);

alter table public.worksheet_lesson_teacher_reviews enable row level security;

drop policy if exists "Authenticated users can view own lesson reviews" on public.worksheet_lesson_teacher_reviews;
create policy "Authenticated users can view own lesson reviews"
  on public.worksheet_lesson_teacher_reviews for select
  using (auth.uid() is not null);

comment on table public.worksheet_lesson_teacher_reviews is
  'Giáo viên đã duyệt xong một tiết. Không hiện lại hộp duyệt cho đến khi giáo viên bấm Duyệt.';
