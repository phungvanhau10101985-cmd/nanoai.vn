-- Thêm trường chi tiết: tập, bài số để match chính xác
alter table worksheet_curricula
  add column if not exists textbook_volume text default null,
  add column if not exists lesson_number int default null,
  add column if not exists topic_normalized text default null;

create index if not exists idx_worksheet_curricula_match on worksheet_curricula(
  subject_id, grade_level_id, textbook_set_id, lesson_type_id,
  num_lessons, lesson_duration_minutes,
  coalesce(textbook_volume, ''), coalesce(lesson_number, 0), coalesce(topic_normalized, ''));

comment on column worksheet_curricula.textbook_volume is 'Tập sách (1, 2) – null nếu không phân tập';
comment on column worksheet_curricula.lesson_number is 'Số bài (1, 2, 3...) – null nếu không có';
comment on column worksheet_curricula.topic_normalized is 'Chủ đề chuẩn hóa để tìm kiếm khớp';
