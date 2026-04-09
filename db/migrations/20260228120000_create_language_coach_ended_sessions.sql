-- Sessions that user explicitly ended. No longer shown in "continue lesson" list.
create table if not exists public.language_coach_ended_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, session_id)
);

create index if not exists idx_language_coach_ended_sessions_user
  on public.language_coach_ended_sessions(user_id);

comment on table public.language_coach_ended_sessions is 'Sessions user explicitly ended. Excluded from continue-lesson list.';

alter table public.language_coach_ended_sessions enable row level security;

drop policy if exists "language_coach_ended_sessions_select_own" on public.language_coach_ended_sessions;
create policy "language_coach_ended_sessions_select_own"
  on public.language_coach_ended_sessions
  for select
  using (auth.uid() = user_id);

drop policy if exists "language_coach_ended_sessions_insert_own" on public.language_coach_ended_sessions;
create policy "language_coach_ended_sessions_insert_own"
  on public.language_coach_ended_sessions
  for insert
  with check (auth.uid() = user_id);
