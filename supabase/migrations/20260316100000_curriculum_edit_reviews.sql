-- Giáo viên gửi admin khi 2 AI báo sai nhưng giáo viên vẫn muốn lưu
create table if not exists curriculum_edit_reviews (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete set null,
  curriculum_id uuid references worksheet_curricula(id) on delete set null,
  topic text not null,
  subject_id text not null,
  grade_level_id text not null,
  textbook_set_id text not null,
  textbook_volume text,
  lesson_number int,
  lesson_type_id text not null,
  num_lessons int not null,
  lesson_duration_minutes int not null,
  goals text,
  content_markdown text not null,
  ai_errors jsonb not null default '[]',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  reviewed_at timestamp with time zone,
  reviewed_by uuid references auth.users(id) on delete set null,
  admin_note text
);

create index idx_curriculum_edit_reviews_status on curriculum_edit_reviews(status);
create index idx_curriculum_edit_reviews_created on curriculum_edit_reviews(created_at desc);
create index idx_curriculum_edit_reviews_user on curriculum_edit_reviews(user_id);

alter table curriculum_edit_reviews enable row level security;

create policy "Users can insert own reviews"
  on curriculum_edit_reviews for insert with check (auth.uid() is not null);

create policy "Users can view own reviews"
  on curriculum_edit_reviews for select using (auth.uid() = user_id);

create policy "Admin can manage all reviews"
  on curriculum_edit_reviews for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

comment on table curriculum_edit_reviews is 'Giáo viên gửi admin khi 2 AI báo sai nhưng vẫn muốn lưu giáo trình';
