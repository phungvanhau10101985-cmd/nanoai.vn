-- Giáo trình cô giáo lưu trong một lớp (theo môn).
create table if not exists public.class_teacher_curricula (
  class_id uuid not null references public.classes(id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  subject_id text not null default '',
  curriculum_id uuid not null references public.worksheet_curricula(id) on delete cascade,
  saved_at timestamp with time zone not null default timezone('utc'::text, now()),
  primary key (class_id, teacher_id, subject_id, curriculum_id)
);

create index if not exists idx_class_teacher_curricula_teacher
  on public.class_teacher_curricula (teacher_id, class_id);

alter table public.class_teacher_curricula enable row level security;

drop policy if exists "Teachers manage curricula saved to their classes" on public.class_teacher_curricula;
create policy "Teachers manage curricula saved to their classes"
  on public.class_teacher_curricula
  for all
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

comment on table public.class_teacher_curricula is 'Giáo trình giáo viên đã tạo hoặc đã mở, lưu theo lớp và môn.';
