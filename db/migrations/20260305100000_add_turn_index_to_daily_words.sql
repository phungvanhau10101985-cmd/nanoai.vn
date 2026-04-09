-- Add turn_index to language_coach_daily_words for per-segment vocabulary
-- turn_index: -1 = session-level (backward compat), 0,1,2,... = specific teacher turn
alter table if exists public.language_coach_daily_words
  add column if not exists turn_index integer default -1;

-- Backfill existing rows: session-level words
update public.language_coach_daily_words
  set turn_index = -1
  where turn_index is null;

alter table if exists public.language_coach_daily_words
  alter column turn_index set default -1;

-- Drop old unique constraint (user_id, session_id, word, target_language)
drop index if exists idx_language_coach_daily_words_user_session_word_target;

-- New unique: allow same word in different turns
create unique index if not exists idx_language_coach_daily_words_user_session_word_target_turn
  on public.language_coach_daily_words(user_id, session_id, word, target_language, turn_index);

-- Index for filtering by turn
create index if not exists idx_language_coach_daily_words_session_turn
  on public.language_coach_daily_words(session_id, turn_index)
  where session_id is not null;
