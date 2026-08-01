-- Landing leads from public site forms (platform backend — tenants edit form labels only).

create table if not exists public.messaging_partner_website_leads (
  id uuid default gen_random_uuid() primary key,
  partner_id uuid not null references public.messaging_partners(id) on delete cascade,
  site_slug text not null,
  name text not null default '',
  phone text not null default '',
  email text not null default '',
  message text not null default '',
  status text not null default 'new' check (status in ('new', 'read', 'archived')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_partner_website_leads_partner
  on public.messaging_partner_website_leads (partner_id, created_at desc);

create index if not exists idx_partner_website_leads_slug
  on public.messaging_partner_website_leads (site_slug);

alter table public.messaging_partner_website_leads enable row level security;

drop policy if exists "Partner owners read own website leads." on public.messaging_partner_website_leads;
create policy "Partner owners read own website leads." on public.messaging_partner_website_leads
  for select using (
    exists (
      select 1 from public.messaging_partners p
      where p.id = messaging_partner_website_leads.partner_id
        and p.owner_user_id = auth.uid()
    )
  );

drop policy if exists "Partner owners update own website leads." on public.messaging_partner_website_leads;
create policy "Partner owners update own website leads." on public.messaging_partner_website_leads
  for update using (
    exists (
      select 1 from public.messaging_partners p
      where p.id = messaging_partner_website_leads.partner_id
        and p.owner_user_id = auth.uid()
    )
  );

-- Expand default enabled sections for landing shop v1 full.
update public.partner_website_platform_settings
set value_json = '{
  "defaultTemplateId": "landing-v1",
  "enabledSectionTypes": [
    "hero-v1",
    "trust-bar-v1",
    "products-v1",
    "features-v1",
    "testimonials-v1",
    "pricing-v1",
    "gallery-v1",
    "faq-v1",
    "lead-form-v1",
    "chat-cta-v1",
    "footer-v1"
  ]
}'::jsonb,
updated_at = timezone('utc'::text, now())
where setting_key = 'section_registry';
