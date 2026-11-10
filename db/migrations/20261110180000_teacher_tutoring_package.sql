-- Gói lớp học thêm: số lớp được giữ, hạn dùng, và mốc giải tán sau 30 ngày không gia hạn.

alter table public.classes
  add column if not exists dissolved_at timestamptz;

comment on column public.classes.dissolved_at is
  'Lớp học thêm bị giải tán vì gói hết hạn quá 30 ngày. Lớp trên trường không dùng cột này.';

create table if not exists public.teacher_tutoring_packages (
  user_id uuid primary key references auth.users(id) on delete cascade,
  class_slots integer not null check (class_slots between 1 and 30),
  access_ends_at timestamptz not null,
  updated_at timestamptz not null default now()
);

comment on table public.teacher_tutoring_packages is
  'Gói lớp học thêm của cô. Hết access_ends_at thì 30 ngày chỉ xem danh sách, rồi các lớp tutoring giải tán.';

alter table public.teacher_tutoring_packages enable row level security;

drop policy if exists teacher_tutoring_packages_select_own on public.teacher_tutoring_packages;
create policy teacher_tutoring_packages_select_own
  on public.teacher_tutoring_packages
  for select
  using (auth.uid() = user_id);

insert into public.app_applied_sql_migrations (migration_filename)
values ('20261110180000_teacher_tutoring_package.sql')
on conflict (migration_filename) do nothing;
