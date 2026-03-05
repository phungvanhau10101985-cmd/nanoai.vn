-- Bảng lưu từng turn hỏi đáp (standalone, dùng cho bài học có sẵn)
-- Bài học chỉ lưu thứ tự turn_ids, khi mở thì fetch theo id
create table if not exists public.language_coach_preset_turns (
  id uuid primary key default gen_random_uuid(),
  turn_index integer not null check (turn_index >= 0),
  source_user_id uuid references auth.users(id) on delete set null,
  source_session_id uuid,
  reply text not null,
  expected_student_text text,
  main_sentence text,
  correction_note text,
  intent_answer text,
  must_know_text text,
  teacher_label text,
  teacher_locale text,
  language_code text,
  target_language text,
  tokens_json text,
  writing_task_json text,
  created_at timestamptz not null default now()
);

create index if not exists idx_language_coach_preset_turns_source
  on public.language_coach_preset_turns(source_user_id, source_session_id);

alter table public.language_coach_preset_turns enable row level security;

drop policy if exists "language_coach_preset_turns_select_auth" on public.language_coach_preset_turns;
create policy "language_coach_preset_turns_select_auth"
  on public.language_coach_preset_turns
  for select
  using (auth.role() = 'authenticated');

drop policy if exists "language_coach_preset_turns_insert_service" on public.language_coach_preset_turns;
create policy "language_coach_preset_turns_insert_service"
  on public.language_coach_preset_turns
  for insert
  with check (true);

drop policy if exists "language_coach_preset_turns_delete_service" on public.language_coach_preset_turns;
create policy "language_coach_preset_turns_delete_service"
  on public.language_coach_preset_turns
  for delete
  using (true);

-- Bài học lưu thứ tự turn (uuid[])
alter table public.language_coach_completed_lessons
  add column if not exists turn_ids uuid[] default '{}';

comment on column public.language_coach_completed_lessons.turn_ids is 'Ordered turn IDs for preset replay. Fetch from language_coach_preset_turns by id.';
