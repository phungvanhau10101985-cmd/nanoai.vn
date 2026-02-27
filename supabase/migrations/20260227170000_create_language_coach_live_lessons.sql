create table if not exists public.language_coach_live_lessons (
  id uuid primary key default gen_random_uuid(),
  source_user_id uuid not null references auth.users(id) on delete cascade,
  source_session_id uuid not null,
  title text not null,
  topic_label text,
  target_language text,
  native_language text,
  quality_score integer not null default 0,
  quality_meta_json text not null default '{}',
  price_credits numeric(10,1) not null default 1.0,
  turns_count integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  approved boolean not null default false,
  sales_count integer not null default 0,
  last_sold_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_user_id, source_session_id)
);

create index if not exists idx_language_coach_live_lessons_status_created
  on public.language_coach_live_lessons(status, created_at desc);

create index if not exists idx_language_coach_live_lessons_source_user
  on public.language_coach_live_lessons(source_user_id, created_at desc);

create table if not exists public.language_coach_live_lesson_turns (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.language_coach_live_lessons(id) on delete cascade,
  turn_index integer not null check (turn_index >= 0),
  source_student_text text not null,
  source_student_norm text not null,
  standardized_student_text text not null,
  standardized_student_norm text not null,
  teacher_reply_text text not null,
  teacher_audio_url text,
  teacher_translation text,
  teacher_tokens_json text,
  teacher_writing_task_json text,
  teacher_main_sentence text,
  teacher_correction_note text,
  teacher_intent_answer text,
  replay_payload_json text not null default '{}',
  created_at timestamptz not null default now(),
  unique (lesson_id, turn_index)
);

create index if not exists idx_language_coach_live_lesson_turns_lesson
  on public.language_coach_live_lesson_turns(lesson_id, turn_index asc);

create table if not exists public.language_coach_live_lesson_purchases (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.language_coach_live_lessons(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  paid_credits numeric(10,1) not null,
  created_at timestamptz not null default now(),
  unique (lesson_id, user_id)
);

create index if not exists idx_language_coach_live_lesson_purchases_user
  on public.language_coach_live_lesson_purchases(user_id, created_at desc);

alter table public.language_coach_live_lessons enable row level security;
alter table public.language_coach_live_lesson_turns enable row level security;
alter table public.language_coach_live_lesson_purchases enable row level security;

drop policy if exists "language_coach_live_lessons_select_auth" on public.language_coach_live_lessons;
create policy "language_coach_live_lessons_select_auth"
  on public.language_coach_live_lessons
  for select
  using (
    auth.role() = 'authenticated'
    and (
      source_user_id = auth.uid()
      or status = 'published'
    )
  );

drop policy if exists "language_coach_live_lessons_insert_own" on public.language_coach_live_lessons;
create policy "language_coach_live_lessons_insert_own"
  on public.language_coach_live_lessons
  for insert
  with check (source_user_id = auth.uid());

drop policy if exists "language_coach_live_lessons_update_own" on public.language_coach_live_lessons;
create policy "language_coach_live_lessons_update_own"
  on public.language_coach_live_lessons
  for update
  using (source_user_id = auth.uid())
  with check (source_user_id = auth.uid());

drop policy if exists "language_coach_live_lesson_turns_select_auth" on public.language_coach_live_lesson_turns;
create policy "language_coach_live_lesson_turns_select_auth"
  on public.language_coach_live_lesson_turns
  for select
  using (
    auth.role() = 'authenticated'
    and exists (
      select 1
      from public.language_coach_live_lessons l
      where l.id = lesson_id
      and (
        l.source_user_id = auth.uid()
        or l.status = 'published'
      )
    )
  );

drop policy if exists "language_coach_live_lesson_purchases_select_own" on public.language_coach_live_lesson_purchases;
create policy "language_coach_live_lesson_purchases_select_own"
  on public.language_coach_live_lesson_purchases
  for select
  using (user_id = auth.uid());

drop policy if exists "language_coach_live_lesson_purchases_insert_own" on public.language_coach_live_lesson_purchases;
create policy "language_coach_live_lesson_purchases_insert_own"
  on public.language_coach_live_lesson_purchases
  for insert
  with check (user_id = auth.uid());
