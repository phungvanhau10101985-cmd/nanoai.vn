-- Soft-reset trash: keep full website snapshot for 7 days so owners can restore after OTP reset.

create table if not exists public.messaging_partner_website_reset_trash (
  id uuid default gen_random_uuid() primary key,
  partner_id uuid not null references public.messaging_partners(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,
  reset_at timestamp with time zone not null default timezone('utc'::text, now()),
  expires_at timestamp with time zone not null,
  restored_at timestamp with time zone null,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  constraint messaging_partner_website_reset_trash_partner_unique unique (partner_id)
);

create index if not exists idx_messaging_partner_website_reset_trash_expires
  on public.messaging_partner_website_reset_trash (expires_at)
  where restored_at is null;

comment on table public.messaging_partner_website_reset_trash is
  'Snapshot of partner website (+ revisions/landings) after OTP reset; restorable until expires_at (~7 days).';

alter table public.messaging_partner_website_reset_trash enable row level security;

drop policy if exists "Partner website reset trash owners manage own." on public.messaging_partner_website_reset_trash;
create policy "Partner website reset trash owners manage own." on public.messaging_partner_website_reset_trash
  for all using (
    exists (
      select 1 from public.messaging_partners p
      where p.id = messaging_partner_website_reset_trash.partner_id
        and p.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.messaging_partners p
      where p.id = messaging_partner_website_reset_trash.partner_id
        and p.owner_user_id = auth.uid()
    )
  );
