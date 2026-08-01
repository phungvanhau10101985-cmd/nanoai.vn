-- Template mode: shared platform templates + tenant theme/pages JSON (customers edit UI only).

alter table public.messaging_partner_websites
  add column if not exists render_mode text not null default 'legacy'
    check (render_mode in ('legacy', 'template')),
  add column if not exists template_id text not null default 'landing-v1',
  add column if not exists theme_json jsonb not null default '{}'::jsonb,
  add column if not exists pages_json jsonb not null default '[]'::jsonb;

create index if not exists idx_messaging_partner_websites_render_mode
  on public.messaging_partner_websites (render_mode);

alter table public.messaging_partner_website_revisions
  add column if not exists render_mode text not null default 'legacy',
  add column if not exists template_id text not null default 'landing-v1',
  add column if not exists theme_json jsonb not null default '{}'::jsonb,
  add column if not exists pages_json jsonb not null default '[]'::jsonb;

-- Platform-owned settings (section enablement, default template) — admin only.
create table if not exists public.partner_website_platform_settings (
  setting_key text primary key,
  value_json jsonb not null default '{}'::jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

insert into public.partner_website_platform_settings (setting_key, value_json)
values (
  'section_registry',
  '{
    "defaultTemplateId": "landing-v1",
    "enabledSectionTypes": [
      "hero-v1",
      "features-v1",
      "faq-v1",
      "chat-cta-v1",
      "gallery-v1",
      "footer-v1"
    ]
  }'::jsonb
)
on conflict (setting_key) do nothing;

alter table public.partner_website_platform_settings enable row level security;

drop policy if exists "Platform settings readable by authenticated." on public.partner_website_platform_settings;
create policy "Platform settings readable by authenticated." on public.partner_website_platform_settings
  for select using (auth.uid() is not null);

drop policy if exists "Platform settings admin write." on public.partner_website_platform_settings;
create policy "Platform settings admin write." on public.partner_website_platform_settings
  for all using (
    exists (
      select 1 from public.profiles pr
      where pr.id = auth.uid() and pr.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles pr
      where pr.id = auth.uid() and pr.role = 'admin'
    )
  );
