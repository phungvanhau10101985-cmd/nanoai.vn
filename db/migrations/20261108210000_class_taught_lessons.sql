-- Tiết cô đã lên lớp: gắn theo lớp + môn của cô, không gỡ lớp khác.
create table if not exists public.class_taught_lessons (
  class_id uuid not null references public.classes(id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  subject_id text not null,
  curriculum_id uuid not null references public.worksheet_curricula(id) on delete cascade,
  lesson_no integer not null,
  taught_at timestamp with time zone not null default timezone('utc'::text, now()),
  primary key (class_id, teacher_id, subject_id, curriculum_id, lesson_no)
);

create index if not exists idx_class_taught_lessons_lookup
  on public.class_taught_lessons (class_id, teacher_id, subject_id, taught_at desc);

alter table public.class_taught_lessons enable row level security;

drop policy if exists "Teachers manage lessons they taught" on public.class_taught_lessons;
create policy "Teachers manage lessons they taught"
  on public.class_taught_lessons
  for all
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

comment on table public.class_taught_lessons is 'Tiết giáo viên đã chọn lớp để lên lớp. Học sinh trong lớp mở lại để ôn.';
