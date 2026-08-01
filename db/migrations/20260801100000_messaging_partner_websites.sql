-- Persistent customer landing/website per messaging partner workspace.
create table if not exists public.messaging_partner_websites (
  id uuid default gen_random_uuid() primary key,
  partner_id uuid not null references public.messaging_partners(id) on delete cascade,
  site_slug text not null unique,
  title text not null default '',
  brief_text text not null default '',
  logo_url text,
  reference_image_urls jsonb not null default '[]'::jsonb,
  project_files_json jsonb not null default '[]'::jsonb,
  html_source text,
  locale text not null default 'vi',
  is_published boolean not null default false,
  published_at timestamp with time zone null,
  source_thread_id uuid null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint messaging_partner_websites_partner_unique unique (partner_id)
);

create index if not exists idx_messaging_partner_websites_slug
  on public.messaging_partner_websites (site_slug);

create index if not exists idx_messaging_partner_websites_partner
  on public.messaging_partner_websites (partner_id);

create index if not exists idx_messaging_partner_websites_published
  on public.messaging_partner_websites (is_published, site_slug)
  where is_published = true;

alter table public.messaging_partner_websites enable row level security;

drop policy if exists "Partner website owners manage own sites." on public.messaging_partner_websites;
create policy "Partner website owners manage own sites." on public.messaging_partner_websites
  for all using (
    exists (
      select 1 from public.messaging_partners p
      where p.id = messaging_partner_websites.partner_id
        and p.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.messaging_partners p
      where p.id = messaging_partner_websites.partner_id
        and p.owner_user_id = auth.uid()
    )
  );

drop policy if exists "Published partner websites are public." on public.messaging_partner_websites;
create policy "Published partner websites are public." on public.messaging_partner_websites
  for select using (is_published = true);
