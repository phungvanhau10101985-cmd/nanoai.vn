create table if not exists public.language_coach_turn_diagnostics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null,
  progress_date date not null,
  target_language text not null,
  native_language text,
  speaking_mode text,
  input_source text,
  had_corrections boolean not null default false,
  pronunciation_score integer,
  pronunciation_accuracy integer,
  pronunciation_fluency integer,
  pronunciation_prosody integer,
  weak_words_json text not null default '[]',
  word_scores_json text not null default '[]',
  inferred_meaning text,
  target_transcript text,
  native_transcript text,
  merged_transcript text,
  created_at timestamptz not null default now()
);

create index if not exists idx_language_coach_turn_diagnostics_user_date
  on public.language_coach_turn_diagnostics(user_id, progress_date desc, created_at desc);

create index if not exists idx_language_coach_turn_diagnostics_user_session
  on public.language_coach_turn_diagnostics(user_id, session_id, created_at desc);

alter table public.language_coach_turn_diagnostics enable row level security;

drop policy if exists "language_coach_turn_diagnostics_select_own" on public.language_coach_turn_diagnostics;
create policy "language_coach_turn_diagnostics_select_own"
  on public.language_coach_turn_diagnostics
  for select
  using (auth.uid() = user_id);
