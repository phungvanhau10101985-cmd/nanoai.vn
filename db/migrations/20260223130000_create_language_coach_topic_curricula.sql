create table if not exists public.language_coach_topic_curricula (
  id uuid primary key default gen_random_uuid(),
  topic_id text not null,
  topic_label text not null,
  normalized_topic_id text not null,
  target_language text not null,
  normalized_target_language text not null,
  native_language text not null,
  normalized_native_language text not null,
  learner_level integer not null default 0,
  roleplay_role text,
  daily_quest text,
  objective text,
  keywords_json text not null,
  starter_sentences_json text not null,
  lesson_steps_json text not null,
  source_model text,
  usage_count integer not null default 1,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (normalized_topic_id, normalized_target_language, normalized_native_language, learner_level)
);

create index if not exists idx_language_coach_topic_curricula_last_used
  on public.language_coach_topic_curricula(last_used_at desc);

alter table public.language_coach_topic_curricula enable row level security;

drop policy if exists "language_coach_topic_curricula_select_all_auth" on public.language_coach_topic_curricula;
create policy "language_coach_topic_curricula_select_all_auth"
  on public.language_coach_topic_curricula
  for select
  using (auth.role() = 'authenticated');
