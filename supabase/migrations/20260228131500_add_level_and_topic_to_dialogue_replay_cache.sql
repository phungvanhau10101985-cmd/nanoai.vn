alter table public.language_coach_dialogue_replay_cache
  add column if not exists learner_level smallint not null default 0;

alter table public.language_coach_dialogue_replay_cache
  add column if not exists topic_id text not null default '';

alter table public.language_coach_dialogue_replay_cache
  add column if not exists normalized_topic_id text not null default '';

alter table public.language_coach_dialogue_replay_cache
  add column if not exists topic_label text not null default '';

alter table public.language_coach_dialogue_replay_cache
  add column if not exists normalized_topic_label text not null default '';

drop index if exists public.uq_language_coach_dialogue_replay_cache_key;
create unique index if not exists uq_language_coach_dialogue_replay_cache_key
  on public.language_coach_dialogue_replay_cache(
    normalized_student_text,
    normalized_target_language,
    normalized_native_language,
    teacher_gender,
    mode,
    learning_mode,
    learner_level,
    normalized_topic_id,
    normalized_topic_label
  );

drop index if exists public.idx_language_coach_dialogue_replay_cache_lookup;
create index if not exists idx_language_coach_dialogue_replay_cache_lookup
  on public.language_coach_dialogue_replay_cache(
    normalized_target_language,
    normalized_native_language,
    teacher_gender,
    mode,
    learning_mode,
    learner_level,
    normalized_topic_id,
    normalized_topic_label,
    updated_at desc
  );
