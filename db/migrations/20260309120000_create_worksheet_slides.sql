-- Bảng lưu slide bài giảng AI (gắn với giáo trình, để giáo viên khác tái sử dụng)
create table if not exists worksheet_slides (
  id uuid default gen_random_uuid() primary key,
  curriculum_id uuid not null references worksheet_curricula(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  topic text,
  subject_id text default 'toan',
  grade_level_id text default 'lop-6',
  content_json jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create unique index idx_worksheet_slides_curriculum_id on worksheet_slides(curriculum_id);
create index idx_worksheet_slides_subject_grade on worksheet_slides(subject_id, grade_level_id);

alter table worksheet_slides enable row level security;

create policy "Authenticated users can insert slides"
  on worksheet_slides for insert
  with check (auth.uid() is not null);

create policy "Authenticated users can view all slides"
  on worksheet_slides for select
  using (auth.uid() is not null);

create policy "Authenticated users can update slides"
  on worksheet_slides for update
  using (auth.uid() is not null);

create policy "Users can delete own slides"
  on worksheet_slides for delete
  using (user_id = auth.uid());

comment on table worksheet_slides is 'Slide bài giảng AI - lưu để giáo viên khác tái sử dụng';
