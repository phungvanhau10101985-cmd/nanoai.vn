-- Snapshots before each website update — restore previous versions from dashboard.
create table if not exists public.messaging_partner_website_revisions (
  id uuid default gen_random_uuid() primary key,
  partner_id uuid not null references public.messaging_partners(id) on delete cascade,
  website_id uuid not null references public.messaging_partner_websites(id) on delete cascade,
  title text not null default '',
  brief_text text not null default '',
  logo_url text,
  reference_image_urls jsonb not null default '[]'::jsonb,
  project_files_json jsonb not null default '[]'::jsonb,
  html_source text,
  locale text not null default 'vi',
  change_note text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_messaging_partner_website_revisions_partner_created
  on public.messaging_partner_website_revisions (partner_id, created_at desc);

alter table public.messaging_partner_website_revisions enable row level security;

drop policy if exists "Partner website revision owners manage own revisions." on public.messaging_partner_website_revisions;
create policy "Partner website revision owners manage own revisions." on public.messaging_partner_website_revisions
  for all using (
    exists (
      select 1 from public.messaging_partners p
      where p.id = messaging_partner_website_revisions.partner_id
        and p.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.messaging_partners p
      where p.id = messaging_partner_website_revisions.partner_id
        and p.owner_user_id = auth.uid()
    )
  );
