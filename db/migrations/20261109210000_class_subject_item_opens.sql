-- Học sinh đã mở tiết ôn, bài thi, bài tập hoặc dòng điểm trong một môn.
-- Số trên menu môn và nhãn «Mới» đọc bảng này. Mở lại thì cập nhật opened_at.
create table if not exists public.class_subject_item_opens (
  user_id uuid not null references auth.users(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  kind text not null,
  item_id text not null,
  opened_at timestamp with time zone not null default timezone('utc'::text, now()),
  primary key (user_id, class_id, kind, item_id),
  constraint class_subject_item_opens_kind_check
    check (kind in ('review', 'exam', 'homework', 'score')),
  constraint class_subject_item_opens_item_id_check
    check (char_length(item_id) between 1 and 80)
);

alter table public.class_subject_item_opens enable row level security;

drop policy if exists "Students read their opened class items" on public.class_subject_item_opens;
create policy "Students read their opened class items"
  on public.class_subject_item_opens
  for select
  using (user_id = auth.uid());

drop policy if exists "Students record opened class items" on public.class_subject_item_opens;
create policy "Students record opened class items"
  on public.class_subject_item_opens
  for insert
  with check (user_id = auth.uid());

drop policy if exists "Students refresh opened class items" on public.class_subject_item_opens;
create policy "Students refresh opened class items"
  on public.class_subject_item_opens
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

comment on table public.class_subject_item_opens is
  'Học sinh đã mở tiết ôn, bài thi, bài tập hoặc dòng điểm. Menu môn gắn số; trong danh sách bài chưa mở hiện nhãn Mới.';
