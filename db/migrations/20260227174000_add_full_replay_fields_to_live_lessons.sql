alter table public.language_coach_live_lessons
  add column if not exists teacher_gender text;

alter table public.language_coach_live_lessons
  add column if not exists teacher_label text;

alter table public.language_coach_live_lessons
  add column if not exists teacher_locale text;

alter table public.language_coach_live_lessons
  add column if not exists language_pair_key text;

create index if not exists idx_language_coach_live_lessons_language_pair
  on public.language_coach_live_lessons(language_pair_key, status, quality_score desc);

alter table public.language_coach_live_lesson_turns
  add column if not exists source_student_audio_url text;

alter table public.language_coach_live_lesson_turns
  add column if not exists source_student_client_message_id text;

alter table public.language_coach_live_lesson_turns
  add column if not exists source_student_db_message_id uuid;

alter table public.language_coach_live_lesson_turns
  add column if not exists teacher_db_message_id uuid;

create index if not exists idx_language_coach_live_lesson_turns_source_student_db_message
  on public.language_coach_live_lesson_turns(source_student_db_message_id);
