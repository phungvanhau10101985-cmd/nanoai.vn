-- Bảng lưu câu hỏi bài tập có sẵn (từ ngân hàng Bộ GD, VNHSGE, SGK...)
-- Dùng cho phần ôn tập / trắc nghiệm thay vì AI tạo
create table if not exists worksheet_official_questions (
  id uuid default gen_random_uuid() primary key,
  subject_id text not null,
  grade_level_id text not null default 'lop-12',
  textbook_set_id text default 'khac',
  lesson_order int,
  question_text text not null,
  options jsonb not null default '[]',
  correct_index int not null default 0,
  explanation text,
  source text not null default 'vnhsge',
  external_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index idx_official_questions_lookup on worksheet_official_questions(subject_id, grade_level_id);
create index idx_official_questions_source on worksheet_official_questions(source);
create unique index idx_official_questions_source_external on worksheet_official_questions(source, external_id) where external_id is not null;

alter table worksheet_official_questions enable row level security;

create policy "Anyone can read official questions"
  on worksheet_official_questions for select
  using (true);

comment on table worksheet_official_questions is 'Câu hỏi có sẵn từ ngân hàng Bộ GD, VNHSGE – dùng cho bài ôn tập thay vì AI';
