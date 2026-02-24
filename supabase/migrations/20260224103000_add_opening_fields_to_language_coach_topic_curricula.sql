alter table public.language_coach_topic_curricula
  add column if not exists opening_line text,
  add column if not exists opening_question text;
