alter table if exists public.language_coach_daily_words
  add column if not exists meaning_items_json text,
  add column if not exists example_items_json text;

alter table if exists public.language_coach_review_queue
  add column if not exists meaning_items_json text,
  add column if not exists example_items_json text;

alter table if exists public.language_coach_vocab_cache
  add column if not exists meaning_items_json text,
  add column if not exists example_items_json text;

