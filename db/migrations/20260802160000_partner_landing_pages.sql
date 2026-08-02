-- Multiple marketing landing pages per partner website (product-attached LPs).
-- Main shop homepage remains messaging_partner_websites; landings are separate rows.

create table if not exists public.messaging_partner_landing_pages (
  id uuid default gen_random_uuid() primary key,
  partner_id uuid not null references public.messaging_partners(id) on delete cascade,
  website_id uuid not null references public.messaging_partner_websites(id) on delete cascade,
  landing_slug text not null,
  title text not null default '',
  brief_text text not null default '',
  locale text not null default 'vi',
  inventory_ids uuid[] not null default '{}'::uuid[],
  project_files_json jsonb not null default '{"entryPath":"index.html","files":[]}'::jsonb,
  html_source text,
  reference_image_urls jsonb not null default '[]'::jsonb,
  mockup_url text,
  is_published boolean not null default false,
  published_at timestamp with time zone null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint messaging_partner_landing_pages_slug_len check (
    char_length(landing_slug) >= 2 and char_length(landing_slug) <= 64
  ),
  constraint messaging_partner_landing_pages_inventory_max check (
    coalesce(cardinality(inventory_ids), 0) <= 8
  ),
  constraint messaging_partner_landing_pages_partner_slug_unique unique (partner_id, landing_slug)
);

create index if not exists idx_messaging_partner_landing_pages_partner_created
  on public.messaging_partner_landing_pages (partner_id, created_at desc);

create index if not exists idx_messaging_partner_landing_pages_website
  on public.messaging_partner_landing_pages (website_id);

create index if not exists idx_messaging_partner_landing_pages_published
  on public.messaging_partner_landing_pages (partner_id, is_published, landing_slug)
  where is_published = true;

comment on table public.messaging_partner_landing_pages is
  'Product-attached marketing landing pages; checkout stays on /site/{slug}/products.';

alter table public.messaging_partner_landing_pages enable row level security;

drop policy if exists "Partner landing page owners manage own landings." on public.messaging_partner_landing_pages;
create policy "Partner landing page owners manage own landings." on public.messaging_partner_landing_pages
  for all using (
    exists (
      select 1 from public.messaging_partners p
      where p.id = messaging_partner_landing_pages.partner_id
        and p.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.messaging_partners p
      where p.id = messaging_partner_landing_pages.partner_id
        and p.owner_user_id = auth.uid()
    )
  );

drop policy if exists "Published partner landing pages are public." on public.messaging_partner_landing_pages;
create policy "Published partner landing pages are public." on public.messaging_partner_landing_pages
  for select using (is_published = true);
