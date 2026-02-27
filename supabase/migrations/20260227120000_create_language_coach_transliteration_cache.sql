create table if not exists public.language_coach_transliteration_cache (
  id uuid primary key default gen_random_uuid(),
  cache_key text not null unique,
  language_code text not null,
  transliteration text not null,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_language_coach_transliteration_cache_key
  on public.language_coach_transliteration_cache(cache_key);

create index if not exists idx_language_coach_transliteration_cache_last_used
  on public.language_coach_transliteration_cache(last_used_at desc);

alter table public.language_coach_transliteration_cache enable row level security;

drop policy if exists "language_coach_transliteration_cache_select_all_auth" on public.language_coach_transliteration_cache;
create policy "language_coach_transliteration_cache_select_all_auth"
  on public.language_coach_transliteration_cache
  for select
  using (auth.role() = 'authenticated');

drop policy if exists "language_coach_transliteration_cache_insert_service" on public.language_coach_transliteration_cache;
create policy "language_coach_transliteration_cache_insert_service"
  on public.language_coach_transliteration_cache
  for insert
  with check (auth.role() = 'authenticated');
drop policy if exists "language_coach_transliteration_cache_update_service" on public.language_coach_transliteration_cache;
create policy "language_coach_transliteration_cache_update_service"
  on public.language_coach_transliteration_cache
  for update
  using (auth.role() = 'authenticated');
