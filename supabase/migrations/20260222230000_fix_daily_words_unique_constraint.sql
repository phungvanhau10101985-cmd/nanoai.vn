do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.language_coach_daily_words'::regclass
      and contype = 'u'
      and conname like 'language_coach_daily_words_user_id_learned_date_word_target%'
  loop
    execute format('alter table public.language_coach_daily_words drop constraint if exists %I', c.conname);
  end loop;
end $$;

create unique index if not exists idx_language_coach_daily_words_user_session_word_target
  on public.language_coach_daily_words(user_id, session_id, word, target_language);

