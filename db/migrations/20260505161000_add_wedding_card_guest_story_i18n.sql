alter table public.wedding_cards
  add column if not exists guest_name text not null default '',
  add column if not exists invitation_text_en text not null default '',
  add column if not exists story_text text not null default '';
