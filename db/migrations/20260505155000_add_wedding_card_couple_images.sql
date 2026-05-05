alter table public.wedding_cards
  add column if not exists groom_image_url text not null default '',
  add column if not exists bride_image_url text not null default '';
