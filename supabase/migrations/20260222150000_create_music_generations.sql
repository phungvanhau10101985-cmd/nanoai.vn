create table if not exists public.music_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('background', 'dj', 'image', 'realtime')),
  title text not null,
  style text not null,
  duration_seconds integer not null check (duration_seconds > 0),
  charged_credits numeric(10,1) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_music_generations_user_created_at
  on public.music_generations(user_id, created_at desc);

alter table public.music_generations enable row level security;

drop policy if exists "music_generations_select_own" on public.music_generations;
create policy "music_generations_select_own"
  on public.music_generations
  for select
  using (auth.uid() = user_id);

drop policy if exists "music_generations_insert_own" on public.music_generations;
create policy "music_generations_insert_own"
  on public.music_generations
  for insert
  with check (auth.uid() = user_id);

