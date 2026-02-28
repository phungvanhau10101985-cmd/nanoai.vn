-- Snapshot of lessons that user completed/end explicitly.
create table if not exists public.language_coach_completed_lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  target_language text,
  native_language text,
  learner_level integer not null default 0,
  language_code text,
  mode text,
  learning_mode text,
  topic_id text,
  topic_label text,
  teacher_label text,
  teacher_locale text,
  total_messages integer not null default 0,
  student_messages integer not null default 0,
  teacher_messages integer not null default 0,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer not null default 0,
  completion_reason text not null default 'user_ended',
  summary_json text not null default '{}',
  transcript_json text not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, session_id)
);

create index if not exists idx_language_coach_completed_lessons_user_ended
  on public.language_coach_completed_lessons(user_id, ended_at desc);

comment on table public.language_coach_completed_lessons is 'Completed lesson snapshots for replay/reporting.';

alter table public.language_coach_completed_lessons enable row level security;

drop policy if exists "language_coach_completed_lessons_select_own" on public.language_coach_completed_lessons;
create policy "language_coach_completed_lessons_select_own"
  on public.language_coach_completed_lessons
  for select
  using (auth.uid() = user_id);

drop policy if exists "language_coach_completed_lessons_insert_own" on public.language_coach_completed_lessons;
create policy "language_coach_completed_lessons_insert_own"
  on public.language_coach_completed_lessons
  for insert
  with check (auth.uid() = user_id);
