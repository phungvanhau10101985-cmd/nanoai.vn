-- Bài học có ≥5 topic để dễ khớp câu hỏi (1 topic câu hỏi khớp 1 trong 5+ topic bài)
alter table worksheet_curricula
  add column if not exists lesson_topics text[] default null;

create index if not exists idx_worksheet_curricula_lesson_topics
  on worksheet_curricula using gin(lesson_topics)
  where lesson_topics is not null and array_length(lesson_topics, 1) >= 1;

comment on column worksheet_curricula.lesson_topics is '≥5 topic chuẩn hóa của bài – dùng để lấy câu hỏi có topic khớp';
