-- Tên trường giáo viên sửa, chờ đủ 7 người chọn rồi mới giữ một tên.

create table if not exists public.school_name_edits (
  school_id uuid primary key references public.schools(id) on delete cascade,
  original_name text not null,
  edited_name text not null,
  edited_normalized text not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_school_name_edits_normalized
  on public.school_name_edits (edited_normalized);

create table if not exists public.school_name_edit_votes (
  school_id uuid not null references public.school_name_edits(school_id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  choice text not null check (choice in ('original', 'edited')),
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (school_id, teacher_id)
);

alter table public.school_name_edits enable row level security;
alter table public.school_name_edit_votes enable row level security;

drop policy if exists "Authenticated can read school name edits" on public.school_name_edits;
create policy "Authenticated can read school name edits"
  on public.school_name_edits for select
  using (auth.uid() is not null);

drop policy if exists "Authenticated can read school name edit votes" on public.school_name_edit_votes;
create policy "Authenticated can read school name edit votes"
  on public.school_name_edit_votes for select
  using (auth.uid() is not null);

comment on table public.school_name_edits is 'Tên trường đang chờ giáo viên chọn giữa tên gốc và tên đã sửa';
comment on table public.school_name_edit_votes is 'Mỗi giáo viên một phiếu cho tên gốc hoặc tên sửa';
