alter table public.language_coach_live_lessons
  add column if not exists topic_id text;

alter table public.language_coach_live_lessons
  add column if not exists learner_level integer;

alter table public.language_coach_live_lessons
  add column if not exists goal_type text;

alter table public.language_coach_live_lessons
  add column if not exists estimated_minutes integer;

alter table public.language_coach_live_lessons
  add column if not exists duration_bucket text;

alter table public.language_coach_live_lessons
  add column if not exists catalog_key text;

create index if not exists idx_language_coach_live_lessons_catalog_lookup
  on public.language_coach_live_lessons(
    status,
    target_language,
    native_language,
    learner_level,
    topic_id,
    goal_type,
    duration_bucket,
    quality_score desc
  );

create index if not exists idx_language_coach_live_lessons_catalog_key
  on public.language_coach_live_lessons(catalog_key);

create table if not exists public.language_coach_live_lesson_starts (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.language_coach_live_lessons(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now()
);

create index if not exists idx_language_coach_live_lesson_starts_user_recent
  on public.language_coach_live_lesson_starts(user_id, started_at desc);

create index if not exists idx_language_coach_live_lesson_starts_lesson_user
  on public.language_coach_live_lesson_starts(lesson_id, user_id, started_at desc);

alter table public.language_coach_live_lesson_starts enable row level security;

drop policy if exists "language_coach_live_lesson_starts_select_own" on public.language_coach_live_lesson_starts;
create policy "language_coach_live_lesson_starts_select_own"
  on public.language_coach_live_lesson_starts
  for select
  using (user_id = auth.uid());

drop policy if exists "language_coach_live_lesson_starts_insert_own" on public.language_coach_live_lesson_starts;
create policy "language_coach_live_lesson_starts_insert_own"
  on public.language_coach_live_lesson_starts
  for insert
  with check (user_id = auth.uid());
