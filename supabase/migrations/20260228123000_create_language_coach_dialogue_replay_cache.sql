create table if not exists public.language_coach_dialogue_replay_cache (
  id uuid primary key default gen_random_uuid(),
  student_text text not null,
  normalized_student_text text not null,
  teacher_gender text not null check (teacher_gender in ('male', 'female')),
  target_language text not null,
  normalized_target_language text not null,
  native_language text not null,
  normalized_native_language text not null,
  mode text not null check (mode in ('chat', 'listen_speak', 'roleplay_short')),
  learning_mode text not null check (learning_mode in ('review', 'reflex')),
  reply text not null,
  corrections_json text not null default '[]',
  pronunciation_tips_json text not null default '[]',
  correction_note text,
  corrected_sentence text,
  intent_answer text,
  main_sentence text,
  must_know_text text,
  hit_count integer not null default 0,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_language_coach_dialogue_replay_cache_key
  on public.language_coach_dialogue_replay_cache(
    normalized_student_text,
    normalized_target_language,
    normalized_native_language,
    teacher_gender,
    mode,
    learning_mode
  );

create index if not exists idx_language_coach_dialogue_replay_cache_lookup
  on public.language_coach_dialogue_replay_cache(
    normalized_target_language,
    normalized_native_language,
    teacher_gender,
    mode,
    learning_mode,
    updated_at desc
  );
