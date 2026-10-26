-- Tên lớp và tên môn đang chờ giáo viên chọn giữa tên gốc và tên đã sửa.
-- Đủ 5 phiếu một phía thì giữ tên đó. Cùng id nên học sinh, giáo viên, bài thi đi theo.

create table if not exists public.class_name_edits (
  class_id uuid primary key references public.classes(id) on delete cascade,
  original_name text not null,
  edited_name text not null,
  edited_normalized text not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_class_name_edits_normalized
  on public.class_name_edits (edited_normalized);

create table if not exists public.class_name_edit_votes (
  class_id uuid not null references public.class_name_edits(class_id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  choice text not null check (choice in ('original', 'edited')),
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (class_id, teacher_id)
);

create table if not exists public.subject_name_edits (
  subject_id varchar(40) primary key,
  original_name text not null,
  edited_name text not null,
  edited_normalized text not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.subject_name_edit_votes (
  subject_id varchar(40) not null references public.subject_name_edits(subject_id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  choice text not null check (choice in ('original', 'edited')),
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (subject_id, teacher_id)
);

create table if not exists public.subject_name_overrides (
  subject_id varchar(40) primary key,
  label text not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.class_name_edits enable row level security;
alter table public.class_name_edit_votes enable row level security;
alter table public.subject_name_edits enable row level security;
alter table public.subject_name_edit_votes enable row level security;
alter table public.subject_name_overrides enable row level security;

drop policy if exists "Authenticated can read class name edits" on public.class_name_edits;
create policy "Authenticated can read class name edits"
  on public.class_name_edits for select
  using (auth.uid() is not null);

drop policy if exists "Authenticated can read class name edit votes" on public.class_name_edit_votes;
create policy "Authenticated can read class name edit votes"
  on public.class_name_edit_votes for select
  using (auth.uid() is not null);

drop policy if exists "Authenticated can read subject name edits" on public.subject_name_edits;
create policy "Authenticated can read subject name edits"
  on public.subject_name_edits for select
  using (auth.uid() is not null);

drop policy if exists "Authenticated can read subject name edit votes" on public.subject_name_edit_votes;
create policy "Authenticated can read subject name edit votes"
  on public.subject_name_edit_votes for select
  using (auth.uid() is not null);

drop policy if exists "Authenticated can read subject name overrides" on public.subject_name_overrides;
create policy "Authenticated can read subject name overrides"
  on public.subject_name_overrides for select
  using (auth.uid() is not null);

comment on table public.class_name_edits is 'Tên lớp đang chờ chọn giữa tên gốc và tên đã sửa';
comment on table public.class_name_edit_votes is 'Mỗi giáo viên một phiếu cho tên lớp gốc hoặc tên sửa';
comment on table public.subject_name_edits is 'Tên môn đang chờ chọn giữa tên gốc và tên đã sửa';
comment on table public.subject_name_edit_votes is 'Mỗi giáo viên một phiếu cho tên môn gốc hoặc tên sửa';
comment on table public.subject_name_overrides is 'Tên môn đã chốt sau khi đủ phiếu, kể cả môn có sẵn trong mã';
