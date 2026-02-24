create table if not exists public.language_coach_session_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  target_language text not null,
  native_language text not null,
  learner_level integer not null default 0,
  topic_id text,
  topic_label text,
  running_summary text not null default '',
  pinned_facts_json text not null default '{}',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, session_id)
);

create index if not exists idx_language_coach_session_memories_user_updated
  on public.language_coach_session_memories(user_id, updated_at desc);

alter table public.language_coach_session_memories enable row level security;

drop policy if exists "language_coach_session_memories_select_own" on public.language_coach_session_memories;
create policy "language_coach_session_memories_select_own"
  on public.language_coach_session_memories
  for select
  using (auth.uid() = user_id);
