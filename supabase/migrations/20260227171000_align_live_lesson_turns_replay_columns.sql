alter table public.language_coach_live_lesson_turns
  add column if not exists source_student_text text;

alter table public.language_coach_live_lesson_turns
  add column if not exists source_student_norm text;

alter table public.language_coach_live_lesson_turns
  add column if not exists standardized_student_text text;

alter table public.language_coach_live_lesson_turns
  add column if not exists standardized_student_norm text;

alter table public.language_coach_live_lesson_turns
  add column if not exists teacher_translation text;

alter table public.language_coach_live_lesson_turns
  add column if not exists teacher_tokens_json text;

alter table public.language_coach_live_lesson_turns
  add column if not exists teacher_writing_task_json text;

alter table public.language_coach_live_lesson_turns
  add column if not exists replay_payload_json text default '{}';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'language_coach_live_lesson_turns'
      and column_name = 'expected_student_text'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'language_coach_live_lesson_turns'
      and column_name = 'expected_student_norm'
  ) then
    execute $sql$
      update public.language_coach_live_lesson_turns
      set
        source_student_text = coalesce(source_student_text, expected_student_text),
        source_student_norm = coalesce(source_student_norm, expected_student_norm),
        standardized_student_text = coalesce(standardized_student_text, expected_student_text),
        standardized_student_norm = coalesce(standardized_student_norm, expected_student_norm)
      where
        source_student_text is null
        or source_student_norm is null
        or standardized_student_text is null
        or standardized_student_norm is null
    $sql$;
  else
    update public.language_coach_live_lesson_turns
    set
      source_student_text = coalesce(source_student_text, standardized_student_text, ''),
      source_student_norm = coalesce(source_student_norm, standardized_student_norm, ''),
      standardized_student_text = coalesce(standardized_student_text, source_student_text, ''),
      standardized_student_norm = coalesce(standardized_student_norm, source_student_norm, '')
    where
      source_student_text is null
      or source_student_norm is null
      or standardized_student_text is null
      or standardized_student_norm is null;
  end if;
end
$$;

alter table public.language_coach_live_lesson_turns
  alter column source_student_text set not null;

alter table public.language_coach_live_lesson_turns
  alter column source_student_norm set not null;

alter table public.language_coach_live_lesson_turns
  alter column standardized_student_text set not null;

alter table public.language_coach_live_lesson_turns
  alter column standardized_student_norm set not null;

alter table public.language_coach_live_lesson_turns
  alter column replay_payload_json set not null;
