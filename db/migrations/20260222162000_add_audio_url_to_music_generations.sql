alter table if exists public.music_generations
  add column if not exists audio_url text;

