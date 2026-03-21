-- Ngân hàng câu hỏi chuẩn – tạo từng câu, verify, tái sử dụng cho phiếu + đề thi
create table if not exists worksheet_questions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete set null,
  curriculum_id uuid references worksheet_curricula(id) on delete set null,
  type text not null check (type in ('quiz', 'essay')),
  subject_id text not null default 'toan',
  grade_level_id text not null default 'lop-6',
  topic text,
  lesson_topics text[],
  difficulty text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  content_json jsonb not null,
  verified_at timestamp with time zone,
  source text not null default 'ai' check (source in ('ai', 'official')),
  "order" int not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- content_json schema:
-- quiz: { "question": string, "options": string[], "correctIndex": number }
-- essay: { "problem": string, "solution": string }

create index idx_worksheet_questions_user on worksheet_questions(user_id);
create index idx_worksheet_questions_curriculum on worksheet_questions(curriculum_id);
create index idx_worksheet_questions_lookup on worksheet_questions(subject_id, grade_level_id);
create index idx_worksheet_questions_type on worksheet_questions(type);
create index idx_worksheet_questions_topic on worksheet_questions using gin(lesson_topics) where lesson_topics is not null;

alter table worksheet_questions enable row level security;

create policy "Users can insert own questions"
  on worksheet_questions for insert
  with check (user_id = auth.uid());

create policy "Anyone can read questions"
  on worksheet_questions for select
  using (true);

comment on table worksheet_questions is 'Ngân hàng câu hỏi chuẩn – tạo từng câu, verify, tái sử dụng cho phiếu + đề thi';
