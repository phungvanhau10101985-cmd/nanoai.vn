alter table if exists public.language_coach_daily_words
  add column if not exists session_id uuid;

alter table if exists public.language_coach_daily_words
  drop constraint if exists language_coach_daily_words_user_id_learned_date_word_target_language_key;

create unique index if not exists idx_language_coach_daily_words_user_session_word_target
  on public.language_coach_daily_words(user_id, session_id, word, target_language);

create index if not exists idx_language_coach_daily_words_user_session_updated
  on public.language_coach_daily_words(user_id, session_id, updated_at desc);

