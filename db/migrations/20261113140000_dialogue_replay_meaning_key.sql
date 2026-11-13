alter table public.language_coach_dialogue_replay_cache
  add column if not exists native_meaning text not null default '';

alter table public.language_coach_dialogue_replay_cache
  add column if not exists normalized_native_meaning text not null default '';

drop index if exists public.uq_language_coach_dialogue_replay_cache_key;
drop index if exists public.idx_language_coach_dialogue_replay_cache_lookup;

create unique index if not exists uq_language_coach_dialogue_replay_meaning_key
  on public.language_coach_dialogue_replay_cache(
    normalized_native_meaning,
    normalized_native_language,
    normalized_target_language,
    learner_level,
    normalized_topic_id
  )
  where normalized_native_meaning <> '';

create index if not exists idx_language_coach_dialogue_replay_meaning_lookup
  on public.language_coach_dialogue_replay_cache(
    normalized_native_meaning,
    normalized_native_language,
    normalized_target_language,
    learner_level,
    normalized_topic_id
  );
