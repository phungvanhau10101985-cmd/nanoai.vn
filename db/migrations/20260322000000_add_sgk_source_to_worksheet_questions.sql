-- Thêm source 'sgk' và 'edited' cho worksheet_questions (SGK: từ ảnh bài tập, edited: sửa tay)
alter table worksheet_questions
  drop constraint if exists worksheet_questions_source_check;

alter table worksheet_questions
  add constraint worksheet_questions_source_check
  check (source in ('ai', 'official', 'sgk', 'edited'));

comment on column worksheet_questions.source is 'ai: AI tạo, official: ngân hàng Bộ GD, sgk: từ ảnh bài tập SGK, edited: sửa tay';
