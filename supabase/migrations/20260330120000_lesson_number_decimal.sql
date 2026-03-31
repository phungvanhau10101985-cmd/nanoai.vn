-- Số bài SGK có thể là 1, 2 hoặc 1.5, 2.5 (mục phụ trong sách — ví dụ Đại số 11)
alter table worksheet_curricula
  alter column lesson_number type numeric(10,2)
  using (case when lesson_number is null then null else lesson_number::numeric end);

comment on column worksheet_curricula.lesson_number is 'Số bài (1, 2, 1.5, 2.5...) — null nếu không có';

alter table worksheet_textbook_lessons
  alter column lesson_order type numeric(10,2)
  using (lesson_order::numeric);

alter table curriculum_edit_reviews
  alter column lesson_number type numeric(10,2)
  using (case when lesson_number is null then null else lesson_number::numeric end);
