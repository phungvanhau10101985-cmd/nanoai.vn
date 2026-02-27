-- Remove duplicate mistagged rows when an English row already exists
-- for the same logical key. Keep the English row, delete CJK/Thai/Hindi mistagged row.

-- 1) Daily words: key is (user_id, session_id, word, target_language)
delete from public.language_coach_daily_words d
where lower(coalesce(d.target_language, '')) in ('japanese', 'ja', 'chinese', 'zh', 'mandarin', 'korean', 'ko', 'thai', 'th', 'hindi', 'hi')
  and coalesce(d.word, '') ~ '^[A-Za-z][A-Za-z0-9 .,''-]*$'
  and exists (
    select 1
    from public.language_coach_daily_words e
    where e.user_id = d.user_id
      and e.session_id = d.session_id
      and e.word = d.word
      and lower(coalesce(e.target_language, '')) = 'english'
  );

-- 2) Review queue: key is (user_id, word, target_language)
delete from public.language_coach_review_queue r
where lower(coalesce(r.target_language, '')) in ('japanese', 'ja', 'chinese', 'zh', 'mandarin', 'korean', 'ko', 'thai', 'th', 'hindi', 'hi')
  and coalesce(r.word, '') ~ '^[A-Za-z][A-Za-z0-9 .,''-]*$'
  and exists (
    select 1
    from public.language_coach_review_queue e
    where e.user_id = r.user_id
      and e.word = r.word
      and lower(coalesce(e.target_language, '')) = 'english'
  );

-- 3) Vocab cache: key is (normalized_word, normalized_target_language, normalized_native_language)
delete from public.language_coach_vocab_cache v
where lower(coalesce(v.target_language, '')) in ('japanese', 'ja', 'chinese', 'zh', 'mandarin', 'korean', 'ko', 'thai', 'th', 'hindi', 'hi')
  and coalesce(v.word, '') ~ '^[A-Za-z][A-Za-z0-9 .,''-]*$'
  and exists (
    select 1
    from public.language_coach_vocab_cache e
    where e.id <> v.id
      and e.normalized_word = v.normalized_word
      and e.normalized_native_language = v.normalized_native_language
      and e.normalized_target_language = 'english'
  );
