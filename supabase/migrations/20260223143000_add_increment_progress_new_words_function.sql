create or replace function public.increment_language_coach_progress_new_words(
  p_user_id uuid,
  p_progress_date date,
  p_target_language text,
  p_inc integer default 1
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.language_coach_progress_daily (
    user_id,
    progress_date,
    target_language,
    new_words_count,
    updated_at
  )
  values (
    p_user_id,
    p_progress_date,
    nullif(trim(coalesce(p_target_language, '')), ''),
    greatest(0, p_inc),
    now()
  )
  on conflict (user_id, progress_date, target_language)
  do update set
    new_words_count = language_coach_progress_daily.new_words_count + greatest(0, p_inc),
    updated_at = now();
end;
$$;

grant execute on function public.increment_language_coach_progress_new_words(uuid, date, text, integer) to anon, authenticated, service_role;
