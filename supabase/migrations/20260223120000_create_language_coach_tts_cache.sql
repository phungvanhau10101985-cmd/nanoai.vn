create table if not exists public.language_coach_tts_cache (
  id uuid primary key default gen_random_uuid(),
  cache_key text not null unique,
  text_hash text not null,
  voice_name text not null,
  locale text not null,
  mime_type text not null default 'audio/wav',
  audio_base64 text not null,
  source_model text,
  usage_count integer not null default 1,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_language_coach_tts_cache_last_used
  on public.language_coach_tts_cache(last_used_at desc);

alter table public.language_coach_tts_cache enable row level security;

drop policy if exists "language_coach_tts_cache_select_all_auth" on public.language_coach_tts_cache;
create policy "language_coach_tts_cache_select_all_auth"
  on public.language_coach_tts_cache
  for select
  using (auth.role() = 'authenticated');
