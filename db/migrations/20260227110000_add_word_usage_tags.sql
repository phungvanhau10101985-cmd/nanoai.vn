alter table if exists public.language_coach_vocab_cache
  add column if not exists usage_level text,
  add column if not exists importance_score integer,
  add column if not exists is_context_sensitive boolean;

alter table if exists public.language_coach_daily_words
  add column if not exists usage_level text,
  add column if not exists importance_score integer,
  add column if not exists is_context_sensitive boolean;

alter table if exists public.language_coach_review_queue
  add column if not exists usage_level text,
  add column if not exists importance_score integer,
  add column if not exists is_context_sensitive boolean;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'language_coach_vocab_cache_usage_level_check'
  ) then
    alter table public.language_coach_vocab_cache
      add constraint language_coach_vocab_cache_usage_level_check
      check (usage_level is null or usage_level in ('high', 'medium', 'low'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'language_coach_daily_words_usage_level_check'
  ) then
    alter table public.language_coach_daily_words
      add constraint language_coach_daily_words_usage_level_check
      check (usage_level is null or usage_level in ('high', 'medium', 'low'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'language_coach_review_queue_usage_level_check'
  ) then
    alter table public.language_coach_review_queue
      add constraint language_coach_review_queue_usage_level_check
      check (usage_level is null or usage_level in ('high', 'medium', 'low'));
  end if;
end $$;

alter table public.language_coach_vocab_cache
  alter column importance_score drop default;

alter table public.language_coach_daily_words
  alter column importance_score drop default;

alter table public.language_coach_review_queue
  alter column importance_score drop default;
