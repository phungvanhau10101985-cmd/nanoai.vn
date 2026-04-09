-- Liên kết phiếu bài tập với câu hỏi trong ngân hàng
alter table worksheet_worksheets
  add column if not exists question_ids uuid[] default '{}';

create index if not exists idx_worksheet_worksheets_question_ids
  on worksheet_worksheets using gin(question_ids)
  where question_ids is not null and array_length(question_ids, 1) > 0;

comment on column worksheet_worksheets.question_ids is 'Thứ tự câu hỏi trong phiếu – tham chiếu worksheet_questions.id. Khi có thì content_markdown sinh từ đây.';
