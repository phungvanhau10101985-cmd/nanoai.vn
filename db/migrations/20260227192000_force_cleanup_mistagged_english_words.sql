-- Strong cleanup for mistagged English-like words.
-- Handles target_language variants (e.g. "Japanese", "ja", "Japanese (N5)", ...).

-- Detect CJK/Thai/Hindi-like target labels by keyword.
-- We only touch Latin-looking words to avoid changing true CJK words.

-- ----------------------------
-- DAILY WORDS
-- ----------------------------

-- 1) Delete mistagged row when an English row already exists for same logical key.
delete from public.language_coach_daily_words d
where coalesce(lower(d.target_language), '') ~ '(japanese|(^|[^a-z])ja([^a-z]|$)|chinese|mandarin|(^|[^a-z])zh([^a-z]|$)|korean|(^|[^a-z])ko([^a-z]|$)|thai|(^|[^a-z])th([^a-z]|$)|hindi|(^|[^a-z])hi([^a-z]|$))'
  and coalesce(d.word, '') ~ '^[A-Za-z][A-Za-z0-9 .,''-]*$'
  and exists (
    select 1
    from public.language_coach_daily_words e
    where e.user_id = d.user_id
      and e.session_id = d.session_id
      and e.word = d.word
      and coalesce(lower(e.target_language), '') ~ '(english|(^|[^a-z])en([^a-z]|$))'
  );

-- 2) Convert remaining mistagged rows to English when no conflict.
with candidates as (
  select d.id
  from public.language_coach_daily_words d
  where coalesce(lower(d.target_language), '') ~ '(japanese|(^|[^a-z])ja([^a-z]|$)|chinese|mandarin|(^|[^a-z])zh([^a-z]|$)|korean|(^|[^a-z])ko([^a-z]|$)|thai|(^|[^a-z])th([^a-z]|$)|hindi|(^|[^a-z])hi([^a-z]|$))'
    and coalesce(d.word, '') ~ '^[A-Za-z][A-Za-z0-9 .,''-]*$'
    and not exists (
      select 1
      from public.language_coach_daily_words e
      where e.user_id = d.user_id
        and e.session_id = d.session_id
        and e.word = d.word
        and coalesce(lower(e.target_language), '') ~ '(english|(^|[^a-z])en([^a-z]|$))'
    )
)
update public.language_coach_daily_words d
set target_language = 'English',
    updated_at = now()
where d.id in (select id from candidates);

-- ----------------------------
-- REVIEW QUEUE
-- ----------------------------

delete from public.language_coach_review_queue r
where coalesce(lower(r.target_language), '') ~ '(japanese|(^|[^a-z])ja([^a-z]|$)|chinese|mandarin|(^|[^a-z])zh([^a-z]|$)|korean|(^|[^a-z])ko([^a-z]|$)|thai|(^|[^a-z])th([^a-z]|$)|hindi|(^|[^a-z])hi([^a-z]|$))'
  and coalesce(r.word, '') ~ '^[A-Za-z][A-Za-z0-9 .,''-]*$'
  and exists (
    select 1
    from public.language_coach_review_queue e
    where e.user_id = r.user_id
      and e.word = r.word
      and coalesce(lower(e.target_language), '') ~ '(english|(^|[^a-z])en([^a-z]|$))'
  );

with candidates as (
  select r.id
  from public.language_coach_review_queue r
  where coalesce(lower(r.target_language), '') ~ '(japanese|(^|[^a-z])ja([^a-z]|$)|chinese|mandarin|(^|[^a-z])zh([^a-z]|$)|korean|(^|[^a-z])ko([^a-z]|$)|thai|(^|[^a-z])th([^a-z]|$)|hindi|(^|[^a-z])hi([^a-z]|$))'
    and coalesce(r.word, '') ~ '^[A-Za-z][A-Za-z0-9 .,''-]*$'
    and not exists (
      select 1
      from public.language_coach_review_queue e
      where e.user_id = r.user_id
        and e.word = r.word
        and coalesce(lower(e.target_language), '') ~ '(english|(^|[^a-z])en([^a-z]|$))'
    )
)
update public.language_coach_review_queue r
set target_language = 'English',
    updated_at = now()
where r.id in (select id from candidates);

-- ----------------------------
-- VOCAB CACHE
-- ----------------------------

delete from public.language_coach_vocab_cache v
where coalesce(lower(v.target_language), '') ~ '(japanese|(^|[^a-z])ja([^a-z]|$)|chinese|mandarin|(^|[^a-z])zh([^a-z]|$)|korean|(^|[^a-z])ko([^a-z]|$)|thai|(^|[^a-z])th([^a-z]|$)|hindi|(^|[^a-z])hi([^a-z]|$))'
  and coalesce(v.word, '') ~ '^[A-Za-z][A-Za-z0-9 .,''-]*$'
  and exists (
    select 1
    from public.language_coach_vocab_cache e
    where e.id <> v.id
      and e.normalized_word = v.normalized_word
      and e.normalized_native_language = v.normalized_native_language
      and e.normalized_target_language = 'english'
  );

with candidates as (
  select v.id
  from public.language_coach_vocab_cache v
  where coalesce(lower(v.target_language), '') ~ '(japanese|(^|[^a-z])ja([^a-z]|$)|chinese|mandarin|(^|[^a-z])zh([^a-z]|$)|korean|(^|[^a-z])ko([^a-z]|$)|thai|(^|[^a-z])th([^a-z]|$)|hindi|(^|[^a-z])hi([^a-z]|$))'
    and coalesce(v.word, '') ~ '^[A-Za-z][A-Za-z0-9 .,''-]*$'
    and not exists (
      select 1
      from public.language_coach_vocab_cache e
      where e.id <> v.id
        and e.normalized_word = v.normalized_word
        and e.normalized_native_language = v.normalized_native_language
        and e.normalized_target_language = 'english'
    )
)
update public.language_coach_vocab_cache v
set target_language = 'English',
    normalized_target_language = 'english',
    updated_at = now()
where v.id in (select id from candidates);
