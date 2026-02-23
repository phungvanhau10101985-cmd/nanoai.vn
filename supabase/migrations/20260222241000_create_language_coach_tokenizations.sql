create table if not exists public.language_coach_tokenizations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_language text not null,
  sentence text not null,
  tokens_json text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, target_language, sentence)
);

create index if not exists idx_language_coach_tokenizations_user_updated
  on public.language_coach_tokenizations(user_id, updated_at desc);

alter table public.language_coach_tokenizations enable row level security;

drop policy if exists "language_coach_tokenizations_select_own" on public.language_coach_tokenizations;
create policy "language_coach_tokenizations_select_own"
  on public.language_coach_tokenizations
  for select
  using (auth.uid() = user_id);

drop policy if exists "language_coach_tokenizations_insert_own" on public.language_coach_tokenizations;
create policy "language_coach_tokenizations_insert_own"
  on public.language_coach_tokenizations
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "language_coach_tokenizations_update_own" on public.language_coach_tokenizations;
create policy "language_coach_tokenizations_update_own"
  on public.language_coach_tokenizations
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

