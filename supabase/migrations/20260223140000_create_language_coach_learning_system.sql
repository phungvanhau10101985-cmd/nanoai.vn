create table if not exists public.language_coach_learning_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_type text not null default 'communication',
  title text not null,
  target_language text not null,
  native_language text not null,
  target_days integer not null default 30,
  target_daily_minutes integer not null default 15,
  target_weekly_sessions integer not null default 5,
  target_pronunciation_score integer not null default 80,
  is_active boolean not null default true,
  started_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_language_coach_learning_goals_user_active
  on public.language_coach_learning_goals(user_id, is_active, updated_at desc);

create table if not exists public.language_coach_progress_daily (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  progress_date date not null,
  target_language text,
  turns_count integer not null default 0,
  sessions_count integer not null default 0,
  corrected_turns integer not null default 0,
  avg_pronunciation_score numeric(5,2) not null default 0,
  pronunciation_samples integer not null default 0,
  new_words_count integer not null default 0,
  streak_days integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, progress_date, target_language)
);

create index if not exists idx_language_coach_progress_daily_user_date
  on public.language_coach_progress_daily(user_id, progress_date desc);

create table if not exists public.language_coach_review_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  word text not null,
  target_language text not null,
  native_language text,
  meaning text,
  pronunciation text,
  repetitions integer not null default 0,
  interval_days integer not null default 1,
  ease_factor numeric(4,2) not null default 2.50,
  due_at timestamptz not null default now(),
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, word, target_language)
);

create index if not exists idx_language_coach_review_queue_user_due
  on public.language_coach_review_queue(user_id, due_at asc);

alter table public.language_coach_learning_goals enable row level security;
alter table public.language_coach_progress_daily enable row level security;
alter table public.language_coach_review_queue enable row level security;

drop policy if exists "language_coach_learning_goals_select_own" on public.language_coach_learning_goals;
create policy "language_coach_learning_goals_select_own"
  on public.language_coach_learning_goals
  for select
  using (auth.uid() = user_id);

drop policy if exists "language_coach_progress_daily_select_own" on public.language_coach_progress_daily;
create policy "language_coach_progress_daily_select_own"
  on public.language_coach_progress_daily
  for select
  using (auth.uid() = user_id);

drop policy if exists "language_coach_review_queue_select_own" on public.language_coach_review_queue;
create policy "language_coach_review_queue_select_own"
  on public.language_coach_review_queue
  for select
  using (auth.uid() = user_id);
