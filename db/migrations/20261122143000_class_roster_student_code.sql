-- Mã định danh học sinh: khóa danh sách lớp và hồ sơ tài khoản.
-- Import cùng mã thì ghi đè tên và ngày sinh, không tạo dòng mới.

alter table public.profiles
  add column if not exists student_code text;

comment on column public.profiles.student_code is
  'Mã định danh học sinh. Khóa để gắn danh sách lớp với tài khoản.';

create unique index if not exists profiles_student_code_uidx
  on public.profiles (student_code)
  where student_code is not null;

create table if not exists public.class_roster_entries (
  class_id uuid not null references public.classes(id) on delete cascade,
  student_code text not null,
  display_name text not null,
  birth_date date not null,
  sort_no integer,
  user_id uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default timezone('utc'::text, now()),
  primary key (class_id, student_code),
  constraint class_roster_entries_code_check check (student_code ~ '^[A-Z0-9]{4,32}$'),
  constraint class_roster_entries_name_check check (char_length(btrim(display_name)) >= 2)
);

create unique index if not exists class_roster_entries_user_uidx
  on public.class_roster_entries (class_id, user_id)
  where user_id is not null;

create index if not exists class_roster_entries_sort_idx
  on public.class_roster_entries (class_id, sort_no);

comment on table public.class_roster_entries is
  'Danh sách học sinh theo mã định danh. Cùng mã thì cập nhật, không thêm học sinh mới.';

alter table public.class_roster_entries enable row level security;

drop policy if exists "Class teachers manage roster" on public.class_roster_entries;
create policy "Class teachers manage roster"
  on public.class_roster_entries
  for all
  using (
    exists (
      select 1 from public.classes c
      where c.id = class_id
        and (
          c.teacher_id = auth.uid()
          or exists (
            select 1 from public.class_subjects s
            where s.class_id = c.id and s.teacher_id = auth.uid()
          )
        )
    )
  )
  with check (
    exists (
      select 1 from public.classes c
      where c.id = class_id
        and (
          c.teacher_id = auth.uid()
          or exists (
            select 1 from public.class_subjects s
            where s.class_id = c.id and s.teacher_id = auth.uid()
          )
        )
    )
  );

drop policy if exists "Class members read roster" on public.class_roster_entries;
create policy "Class members read roster"
  on public.class_roster_entries
  for select
  using (
    exists (
      select 1 from public.class_members m
      where m.class_id = class_roster_entries.class_id
        and m.user_id = auth.uid()
    )
  );
