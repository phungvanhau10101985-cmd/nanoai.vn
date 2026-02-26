create table if not exists public.language_coach_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  assessment_type text not null check (assessment_type in ('baseline', 'checkpoint')),
  target_language text not null,
  native_language text,
  cefr_level text not null,
  learner_level integer not null default 0 check (learner_level between 0 and 4),
  confidence integer not null default 60 check (confidence between 0 and 100),
  overall_score integer not null default 0 check (overall_score between 0 and 100),
  speaking_score integer check (speaking_score between 0 and 100),
  listening_score integer check (listening_score between 0 and 100),
  reading_score integer check (reading_score between 0 and 100),
  writing_score integer check (writing_score between 0 and 100),
  samples_json text,
  summary text not null,
  taken_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_language_coach_assessments_user_target_taken
  on public.language_coach_assessments(user_id, target_language, taken_at desc);

create index if not exists idx_language_coach_assessments_user_type_taken
  on public.language_coach_assessments(user_id, assessment_type, taken_at desc);

alter table public.language_coach_assessments enable row level security;

drop policy if exists "language_coach_assessments_select_own" on public.language_coach_assessments;
create policy "language_coach_assessments_select_own"
  on public.language_coach_assessments
  for select
  using (auth.uid() = user_id);
