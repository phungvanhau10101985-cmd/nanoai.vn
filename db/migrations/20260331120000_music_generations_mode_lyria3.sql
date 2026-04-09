-- Lyria 3 saves history with mode = 'lyria3'; extend check constraint (was only realtime/background/dj/image).

alter table public.music_generations
  drop constraint if exists music_generations_mode_check;

alter table public.music_generations
  add constraint music_generations_mode_check
  check (mode in ('background', 'dj', 'image', 'realtime', 'lyria3'));
