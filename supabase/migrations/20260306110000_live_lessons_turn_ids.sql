-- Live lessons: lưu thứ tự turn theo id (giống completed_lessons)
alter table public.language_coach_live_lessons
  add column if not exists turn_ids uuid[] default '{}';

comment on column public.language_coach_live_lessons.turn_ids is 'Ordered turn IDs for loading from language_coach_live_lesson_turns by id.';
