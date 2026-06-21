-- Premium wedding invitation content fields.
-- Additive only: existing cards keep rendering with empty/default fallbacks.
alter table public.wedding_cards
  add column if not exists couple_intro text not null default '',
  add column if not exists love_quote text not null default '',
  add column if not exists event_timeline text not null default '',
  add column if not exists dress_code text not null default '',
  add column if not exists thank_you_text text not null default '',
  add column if not exists section_config jsonb not null default '{}'::jsonb;
