-- Exam school/class tagging:
-- - Teacher selects school once (can update later)
-- - Exam session binds to class + school
-- - Student attempts store user/class/school tags for reporting

create table if not exists schools (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  normalized_name text not null unique,
  search_tokens text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_schools_name on schools(name);
create index if not exists idx_schools_normalized on schools(normalized_name);

alter table schools enable row level security;

create policy "Authenticated can read schools"
  on schools for select
  using (auth.uid() is not null);

create policy "Authenticated can create schools"
  on schools for insert
  with check (auth.uid() is not null);

comment on table schools is 'Danh mục trường học chuẩn hoá dần từ dữ liệu giáo viên';

create table if not exists teacher_school_settings (
  teacher_id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid not null references schools(id) on delete restrict,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_teacher_school_settings_school on teacher_school_settings(school_id);

alter table teacher_school_settings enable row level security;

create policy "Teacher manages own school setting"
  on teacher_school_settings for all
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

comment on table teacher_school_settings is 'Trường mặc định của giáo viên khi tạo bài thi';

alter table classes
  add column if not exists school_id uuid references schools(id) on delete set null,
  add column if not exists grade_level_id text;

create index if not exists idx_classes_school on classes(school_id);

alter table exam_sessions
  add column if not exists class_id uuid references classes(id) on delete set null,
  add column if not exists school_id uuid references schools(id) on delete set null;

create index if not exists idx_exam_sessions_class on exam_sessions(class_id);
create index if not exists idx_exam_sessions_school on exam_sessions(school_id);

alter table exam_attempts
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists class_id uuid references classes(id) on delete set null,
  add column if not exists school_id uuid references schools(id) on delete set null;

create index if not exists idx_exam_attempts_user on exam_attempts(user_id);
create index if not exists idx_exam_attempts_class on exam_attempts(class_id);
create index if not exists idx_exam_attempts_school on exam_attempts(school_id);
create index if not exists idx_exam_attempts_session_class_school_user on exam_attempts(session_id, class_id, school_id, user_id);

comment on column exam_sessions.class_id is 'Lớp đã gắn khi giáo viên tạo đề';
comment on column exam_sessions.school_id is 'Trường đã gắn khi giáo viên tạo đề';
comment on column exam_attempts.user_id is 'Tài khoản học sinh đã đăng nhập';
comment on column exam_attempts.class_id is 'Tag lớp cố định theo đề thi';
comment on column exam_attempts.school_id is 'Tag trường cố định theo đề thi';
