-- Fix legacy records where target_language was saved as CJK/Thai/Hindi
-- but the word/example text is clearly Latin (English-like).
-- This keeps autofix enabled while preventing old mis-tags from propagating.

-- daily_words: avoid unique conflict (user_id, session_id, word, target_language)
with candidates as (
  select d.id
  from public.language_coach_daily_words d
  where lower(coalesce(d.target_language, '')) in ('japanese', 'ja', 'chinese', 'zh', 'mandarin', 'korean', 'ko', 'thai', 'th', 'hindi', 'hi')
    and coalesce(d.word, '') ~ '^[A-Za-z][A-Za-z0-9 .,''-]*$'
    and (
      coalesce(d.example_target, '') = ''
      or coalesce(d.example_target, '') ~ '^[A-Za-z0-9 .,!?:;''"()_-]*$'
    )
    and not exists (
      select 1
      from public.language_coach_daily_words d2
      where d2.user_id = d.user_id
        and d2.session_id = d.session_id
        and d2.word = d.word
        and lower(coalesce(d2.target_language, '')) = 'english'
    )
)
update public.language_coach_daily_words d
set target_language = 'English',
    updated_at = now()
where d.id in (select id from candidates);

-- review_queue: avoid unique conflict (user_id, word, target_language)
with candidates as (
  select r.id
  from public.language_coach_review_queue r
  where lower(coalesce(r.target_language, '')) in ('japanese', 'ja', 'chinese', 'zh', 'mandarin', 'korean', 'ko', 'thai', 'th', 'hindi', 'hi')
    and coalesce(r.word, '') ~ '^[A-Za-z][A-Za-z0-9 .,''-]*$'
    and not exists (
      select 1
      from public.language_coach_review_queue r2
      where r2.user_id = r.user_id
        and r2.word = r.word
        and lower(coalesce(r2.target_language, '')) = 'english'
    )
)
update public.language_coach_review_queue r
set target_language = 'English',
    updated_at = now()
where r.id in (select id from candidates);

-- vocab_cache: avoid unique conflict (normalized_word, normalized_target_language, normalized_native_language)
with candidates as (
  select v.id
  from public.language_coach_vocab_cache v
  where lower(coalesce(v.target_language, '')) in ('japanese', 'ja', 'chinese', 'zh', 'mandarin', 'korean', 'ko', 'thai', 'th', 'hindi', 'hi')
    and coalesce(v.word, '') ~ '^[A-Za-z][A-Za-z0-9 .,''-]*$'
    and (
      coalesce(v.example_target, '') = ''
      or coalesce(v.example_target, '') ~ '^[A-Za-z0-9 .,!?:;''"()_-]*$'
    )
    and not exists (
      select 1
      from public.language_coach_vocab_cache v2
      where v2.id <> v.id
        and v2.normalized_word = v.normalized_word
        and v2.normalized_native_language = v.normalized_native_language
        and v2.normalized_target_language = 'english'
    )
)
update public.language_coach_vocab_cache v
set target_language = 'English',
    normalized_target_language = 'english',
    updated_at = now()
where v.id in (select id from candidates);
