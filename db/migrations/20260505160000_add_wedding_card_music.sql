alter table public.wedding_cards
  add column if not exists music_url text not null default '';
