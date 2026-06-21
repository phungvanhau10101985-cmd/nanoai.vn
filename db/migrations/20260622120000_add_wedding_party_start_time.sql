alter table public.wedding_cards
  add column if not exists party_start_time text not null default '';
