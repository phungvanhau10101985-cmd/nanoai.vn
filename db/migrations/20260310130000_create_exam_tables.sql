-- Bài thi trực tuyến: 15 phút, 1 tiết, học kỳ, tốt nghiệp
-- Giáo viên tạo → QR/link → học sinh làm → chấm tự động

-- Thêm difficulty cho câu hỏi (dễ, trung bình, khó)
alter table worksheet_official_questions
  add column if not exists difficulty text default 'medium' check (difficulty in ('easy', 'medium', 'hard'));

create index if not exists idx_official_questions_difficulty
  on worksheet_official_questions(subject_id, grade_level_id, difficulty)
  where difficulty is not null;

comment on column worksheet_official_questions.difficulty is 'Độ khó: easy, medium, hard';

-- Phiên thi
create table if not exists exam_sessions (
  id uuid default gen_random_uuid() primary key,
  code text not null unique,
  teacher_id uuid references auth.users(id) on delete set null,
  title text not null default 'Bài thi',
  exam_type text not null default '15ph' check (exam_type in ('15ph', '1tiet', 'hocky', 'totnghiep')),
  subject_id text not null,
  grade_level_id text not null default 'lop-12',
  duration_minutes int not null,
  minutes_per_question numeric(4,1) not null default 1,
  config jsonb not null default '[]',
  status text not null default 'active' check (status in ('active', 'closed')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index idx_exam_sessions_teacher on exam_sessions(teacher_id);
create index idx_exam_sessions_code on exam_sessions(code);
create index idx_exam_sessions_created on exam_sessions(created_at desc);

alter table exam_sessions enable row level security;

create policy "Teachers can manage own exam sessions"
  on exam_sessions for all
  using (auth.uid() = teacher_id)
  with check (auth.uid() = teacher_id);

-- Câu hỏi trong phiên (lấy từ DB khi tạo, lưu để chấm)
create table if not exists exam_questions (
  id uuid default gen_random_uuid() primary key,
  session_id uuid not null references exam_sessions(id) on delete cascade,
  question_text text not null,
  options jsonb not null default '[]',
  correct_index int not null default 0,
  "order" int not null default 0,
  source text default 'official',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index idx_exam_questions_session on exam_questions(session_id);

alter table exam_questions enable row level security;

create policy "Teachers can read exam questions for own sessions"
  on exam_questions for select
  using (
    exists (select 1 from exam_sessions s where s.id = session_id and s.teacher_id = auth.uid())
  );

create policy "Teachers can insert exam questions for own sessions"
  on exam_questions for insert
  with check (
    exists (select 1 from exam_sessions s where s.id = session_id and s.teacher_id = auth.uid())
  );

-- Bài làm của học sinh
create table if not exists exam_attempts (
  id uuid default gen_random_uuid() primary key,
  session_id uuid not null references exam_sessions(id) on delete cascade,
  student_name text,
  student_code text,
  question_order int[],
  answers jsonb not null default '{}',
  score int default 0,
  max_score int default 0,
  started_at timestamp with time zone,
  submitted_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index idx_exam_attempts_session on exam_attempts(session_id);
create index idx_exam_attempts_submitted on exam_attempts(session_id, submitted_at desc);

alter table exam_attempts enable row level security;

create policy "Teachers can view attempts for own sessions"
  on exam_attempts for select
  using (
    exists (select 1 from exam_sessions s where s.id = session_id and s.teacher_id = auth.uid())
  );

create policy "Anyone can insert attempt"
  on exam_attempts for insert
  with check (true);

create policy "Students can update own attempt"
  on exam_attempts for update
  using (true)
  with check (true);

comment on table exam_sessions is 'Phiên thi – 15 phút, 1 tiết, học kỳ, tốt nghiệp';
comment on table exam_questions is 'Câu hỏi trong phiên – lấy từ DB khi tạo';
comment on table exam_attempts is 'Bài làm của học sinh';
