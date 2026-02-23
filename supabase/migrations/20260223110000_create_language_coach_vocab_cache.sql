create table if not exists public.language_coach_vocab_cache (
  id uuid primary key default gen_random_uuid(),
  word text not null,
  normalized_word text not null,
  target_language text not null,
  normalized_target_language text not null,
  native_language text not null,
  normalized_native_language text not null,
  context_hash text,
  part_of_speech text,
  meaning text not null,
  pronunciation text,
  example_target text,
  example_native text,
  pronunciation_audio_url text,
  source_model text,
  usage_count integer not null default 1,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (normalized_word, normalized_target_language, normalized_native_language)
);

create index if not exists idx_language_coach_vocab_cache_last_used
  on public.language_coach_vocab_cache(last_used_at desc);

alter table public.language_coach_vocab_cache enable row level security;

drop policy if exists "language_coach_vocab_cache_select_all_auth" on public.language_coach_vocab_cache;
create policy "language_coach_vocab_cache_select_all_auth"
  on public.language_coach_vocab_cache
  for select
  using (auth.role() = 'authenticated');
