-- Chỉ mục tra cache bài theo chủ đề bằng topic_normalized.
create index if not exists idx_worksheet_curricula_topic_cache
  on public.worksheet_curricula (
    subject_id,
    grade_level_id,
    lesson_type_id,
    num_lessons,
    lesson_duration_minutes,
    topic_normalized
  )
  where lesson_number is null
    and topic_normalized is not null
    and topic_normalized <> '';

comment on column public.worksheet_curricula.topic_normalized is
  'Khóa cache bài theo chủ đề: bỏ nhãn Chủ đề/Bài/Chương/Tiết, bỏ dấu, chữ thường.';
