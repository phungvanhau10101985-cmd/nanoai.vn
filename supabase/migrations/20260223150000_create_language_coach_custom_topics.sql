create table if not exists public.language_coach_custom_topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  raw_topic text not null,
  topic_id text not null,
  topic_label text not null,
  topic_difficulty text not null default 'basic',
  target_language text not null,
  native_language text not null,
  learner_level integer not null default 0,
  normalized_topic_id text not null,
  normalized_target_language text not null,
  normalized_native_language text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz
);

create unique index if not exists uq_language_coach_custom_topics_user_topic_lang
  on public.language_coach_custom_topics(user_id, normalized_topic_id, normalized_target_language, normalized_native_language);

create index if not exists idx_language_coach_custom_topics_user_updated
  on public.language_coach_custom_topics(user_id, updated_at desc);

alter table public.language_coach_custom_topics enable row level security;

drop policy if exists "language_coach_custom_topics_select_own" on public.language_coach_custom_topics;
create policy "language_coach_custom_topics_select_own"
  on public.language_coach_custom_topics
  for select
  using (auth.uid() = user_id);
