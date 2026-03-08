-- Bảng lưu giáo trình AI (để giáo viên khác tái sử dụng khi tạo giáo án)
create table if not exists worksheet_curricula (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete set null,
  topic text not null,
  subject_id text not null default 'toan',
  grade_level_id text not null default 'lop-6',
  textbook_set_id text not null default 'ket-noi-tri-thuc',
  lesson_type_id text not null default 'hinh-thanh-kien-thuc',
  num_lessons int not null default 5,
  lesson_duration_minutes int not null default 45,
  goals text default '',
  content_markdown text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index idx_worksheet_curricula_user_id on worksheet_curricula(user_id);
create index idx_worksheet_curricula_created_at on worksheet_curricula(created_at);
create index idx_worksheet_curricula_subject_grade on worksheet_curricula(subject_id, grade_level_id);

alter table worksheet_curricula enable row level security;

-- User có thể tạo giáo trình của mình
create policy "Users can insert own curricula"
  on worksheet_curricula for insert
  with check (user_id = auth.uid());

-- Mọi user đã đăng nhập có thể xem tất cả giáo trình (để giáo viên khác tái sử dụng)
create policy "Authenticated users can view all curricula"
  on worksheet_curricula for select
  using (auth.uid() is not null);

comment on table worksheet_curricula is 'Giáo trình AI - lưu để giáo viên khác tái sử dụng khi tạo giáo án';
