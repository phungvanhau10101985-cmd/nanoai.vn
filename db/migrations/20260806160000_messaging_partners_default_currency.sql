-- S0.10 — default display/tracking currency per partner (no FX conversion).
alter table public.messaging_partners
  add column if not exists default_currency text not null default 'VND';

comment on column public.messaging_partners.default_currency is
  'S0.10 ISO-like currency code for display + tracking (default VND)';
