create table if not exists public.language_coach_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  role text not null check (role in ('teacher', 'student')),
  text text not null,
  audio_url text,
  language_code text,
  target_language text,
  teacher_label text,
  teacher_locale text,
  mode text not null default 'chat' check (mode in ('chat', 'story')),
  created_at timestamptz not null default now()
);

create index if not exists idx_language_coach_messages_user_created_at
  on public.language_coach_messages(user_id, created_at desc);

create index if not exists idx_language_coach_messages_user_session_created_at
  on public.language_coach_messages(user_id, session_id, created_at asc);

alter table public.language_coach_messages enable row level security;

drop policy if exists "language_coach_messages_select_own" on public.language_coach_messages;
create policy "language_coach_messages_select_own"
  on public.language_coach_messages
  for select
  using (auth.uid() = user_id);

drop policy if exists "language_coach_messages_insert_own" on public.language_coach_messages;
create policy "language_coach_messages_insert_own"
  on public.language_coach_messages
  for insert
  with check (auth.uid() = user_id);

