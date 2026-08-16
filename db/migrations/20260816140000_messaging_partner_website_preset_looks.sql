-- Per-preset shop look snapshots (Sửa nhanh HTML + theme) so switching templates
-- and switching back restores the merchant's edits instead of wiping them.
create table if not exists public.messaging_partner_website_preset_looks (
  partner_id uuid not null references public.messaging_partners(id) on delete cascade,
  website_id uuid not null references public.messaging_partner_websites(id) on delete cascade,
  preset_id text not null,
  template_id text not null default '',
  theme_json jsonb not null default '{}'::jsonb,
  pages_json jsonb not null default '[]'::jsonb,
  project_files_json jsonb not null default '{"entryPath":"index.html","files":[]}'::jsonb,
  html_source text,
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  primary key (partner_id, preset_id),
  constraint messaging_partner_website_preset_looks_preset_id_chk
    check (char_length(btrim(preset_id)) between 1 and 64)
);

create index if not exists idx_messaging_partner_website_preset_looks_website
  on public.messaging_partner_website_preset_looks (website_id);

comment on table public.messaging_partner_website_preset_looks is
  'Saved shop look per template preset (visual HTML + theme). Restored when merchant switches back.';

alter table public.messaging_partner_website_preset_looks enable row level security;

drop policy if exists "Partner website preset look owners manage own looks." on public.messaging_partner_website_preset_looks;
create policy "Partner website preset look owners manage own looks." on public.messaging_partner_website_preset_looks
  for all using (
    exists (
      select 1 from public.messaging_partners p
      where p.id = messaging_partner_website_preset_looks.partner_id
        and p.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.messaging_partners p
      where p.id = messaging_partner_website_preset_looks.partner_id
        and p.owner_user_id = auth.uid()
    )
  );
