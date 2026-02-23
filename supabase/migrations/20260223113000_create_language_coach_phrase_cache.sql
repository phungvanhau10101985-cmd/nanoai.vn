create table if not exists public.language_coach_phrase_cache (
  id uuid primary key default gen_random_uuid(),
  source_text text not null,
  normalized_source_text text not null,
  target_language text not null,
  normalized_target_language text not null,
  native_language text not null,
  normalized_native_language text not null,
  target_sentence text not null,
  native_meaning text,
  pinyin text,
  source_model text,
  usage_count integer not null default 1,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (normalized_source_text, normalized_target_language, normalized_native_language)
);

create index if not exists idx_language_coach_phrase_cache_last_used
  on public.language_coach_phrase_cache(last_used_at desc);

alter table public.language_coach_phrase_cache enable row level security;

drop policy if exists "language_coach_phrase_cache_select_all_auth" on public.language_coach_phrase_cache;
create policy "language_coach_phrase_cache_select_all_auth"
  on public.language_coach_phrase_cache
  for select
  using (auth.role() = 'authenticated');
