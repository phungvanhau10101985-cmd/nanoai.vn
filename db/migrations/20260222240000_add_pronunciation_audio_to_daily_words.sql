alter table if exists public.language_coach_daily_words
  add column if not exists pronunciation_audio_url text;

