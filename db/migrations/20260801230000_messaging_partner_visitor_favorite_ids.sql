-- Favorite products per visitor (partner shop / landing personalization).

alter table public.messaging_partner_visitor_personalization
  add column if not exists favorite_ids jsonb not null default '[]'::jsonb;

comment on column public.messaging_partner_visitor_personalization.favorite_ids is
  'JSON array of inventory UUID strings the visitor favorited, most recent first (max ~48).';
