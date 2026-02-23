create table if not exists public.language_coach_daily_words (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  learned_date date not null,
  word text not null,
  target_language text,
  native_language text,
  meaning text,
  pronunciation text,
  example_target text,
  example_native text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, learned_date, word, target_language)
);

create index if not exists idx_language_coach_daily_words_user_date
  on public.language_coach_daily_words(user_id, learned_date desc, updated_at desc);

alter table public.language_coach_daily_words enable row level security;

drop policy if exists "language_coach_daily_words_select_own" on public.language_coach_daily_words;
create policy "language_coach_daily_words_select_own"
  on public.language_coach_daily_words
  for select
  using (auth.uid() = user_id);

drop policy if exists "language_coach_daily_words_insert_own" on public.language_coach_daily_words;
create policy "language_coach_daily_words_insert_own"
  on public.language_coach_daily_words
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "language_coach_daily_words_update_own" on public.language_coach_daily_words;
create policy "language_coach_daily_words_update_own"
  on public.language_coach_daily_words
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

