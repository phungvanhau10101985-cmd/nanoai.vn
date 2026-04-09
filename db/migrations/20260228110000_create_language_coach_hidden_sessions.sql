-- Track sessions that user has "deleted" from their UI.
-- Data stays in messages/session_memories for lesson library and conversation pool.
create table if not exists public.language_coach_hidden_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, session_id)
);

create index if not exists idx_language_coach_hidden_sessions_user
  on public.language_coach_hidden_sessions(user_id);

comment on table public.language_coach_hidden_sessions is 'Sessions hidden by user from their UI. Data remains in messages/session_memories for lesson library and conversation pool.';

alter table public.language_coach_hidden_sessions enable row level security;

drop policy if exists "language_coach_hidden_sessions_select_own" on public.language_coach_hidden_sessions;
create policy "language_coach_hidden_sessions_select_own"
  on public.language_coach_hidden_sessions
  for select
  using (auth.uid() = user_id);

drop policy if exists "language_coach_hidden_sessions_insert_own" on public.language_coach_hidden_sessions;
create policy "language_coach_hidden_sessions_insert_own"
  on public.language_coach_hidden_sessions
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "language_coach_hidden_sessions_delete_own" on public.language_coach_hidden_sessions;
create policy "language_coach_hidden_sessions_delete_own"
  on public.language_coach_hidden_sessions
  for delete
  using (auth.uid() = user_id);
