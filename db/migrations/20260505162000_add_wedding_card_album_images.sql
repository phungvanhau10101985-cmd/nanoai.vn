alter table public.wedding_cards
  add column if not exists album_image_urls text[] not null default '{}';
