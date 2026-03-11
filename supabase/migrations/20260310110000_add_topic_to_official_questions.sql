-- Thêm topic_label, topic_normalized cho chuẩn hóa câu hỏi → ghép vào bài học
alter table worksheet_official_questions
  add column if not exists topic_label text,
  add column if not exists topic_normalized text;

create index if not exists idx_official_questions_topic_normalized
  on worksheet_official_questions(subject_id, grade_level_id, topic_normalized)
  where topic_normalized is not null and topic_normalized != '';

comment on column worksheet_official_questions.topic_label is 'Chủ đề/kiến thức chính (1-5 từ, từ AI)';
comment on column worksheet_official_questions.topic_normalized is 'Chuẩn hóa để so khớp với topic giáo trình';
