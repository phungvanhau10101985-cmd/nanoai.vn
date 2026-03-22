-- Liên kết câu trong phiên thi với worksheet_questions để chữa bài lấy lời giải / giải thích từ DB
alter table exam_questions
  add column if not exists worksheet_question_id uuid null references worksheet_questions(id) on delete set null;

create index if not exists idx_exam_questions_worksheet_question
  on exam_questions(worksheet_question_id)
  where worksheet_question_id is not null;

comment on column exam_questions.worksheet_question_id is 'Câu gốc trong worksheet_questions (quiz/essay) — dùng khi chữa bài để lấy lời giải';
