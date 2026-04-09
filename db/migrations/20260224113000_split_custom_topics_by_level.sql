with ranked as (
  select
    id,
    row_number() over (
      partition by normalized_topic_id, normalized_target_language, normalized_native_language, learner_level
      order by updated_at desc, created_at desc
    ) as rn
  from public.language_coach_custom_topics
)
delete from public.language_coach_custom_topics t
using ranked r
where t.id = r.id
  and r.rn > 1;

drop index if exists uq_language_coach_custom_topics_shared_topic_lang;

create unique index if not exists uq_language_coach_custom_topics_shared_topic_lang
  on public.language_coach_custom_topics(
    normalized_topic_id,
    normalized_target_language,
    normalized_native_language,
    learner_level
  );

drop index if exists idx_language_coach_custom_topics_shared_updated;

create index if not exists idx_language_coach_custom_topics_shared_updated
  on public.language_coach_custom_topics(
    normalized_target_language,
    normalized_native_language,
    learner_level,
    updated_at desc
  );
