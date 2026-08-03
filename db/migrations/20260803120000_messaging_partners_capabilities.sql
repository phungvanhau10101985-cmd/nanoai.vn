-- Unified partner website / commerce capabilities (all industries share one platform).
alter table public.messaging_partners
  add column if not exists partner_capabilities jsonb not null default '{}'::jsonb;

comment on column public.messaging_partners.partner_capabilities is
  'Per-partner feature flags for website sections, commerce, and hospitality booking. Empty {} = industry defaults in app code.';
