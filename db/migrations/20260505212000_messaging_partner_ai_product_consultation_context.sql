alter table public.messaging_partner_ai_settings
  add column if not exists product_consultation_context text not null default '';

comment on column public.messaging_partner_ai_settings.product_consultation_context is
  'Shop-authored policies/notes that are always included in product consultation AI context.';
