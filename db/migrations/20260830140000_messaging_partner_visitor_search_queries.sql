-- Search history per logged-in shop visitor (guest account or linked user).
-- Guests keep queries in the browser only; this column is account-backed.

alter table public.messaging_partner_visitor_personalization
  add column if not exists search_queries jsonb not null default '[]'::jsonb;

comment on column public.messaging_partner_visitor_personalization.search_queries is
  'JSON array of recent search query strings, most recent first (max ~12). Logged-in visitors only.';
