-- Hub Studio landing page — public share link (composed section preview, 90 days)

create table if not exists public.hub_landing_page_shares (
  id uuid default gen_random_uuid() primary key,
  share_token text not null unique,
  user_id uuid,
  thread_id uuid,
  title text not null default '',
  logo_url text,
  sections_json jsonb not null default '[]'::jsonb,
  locale text not null default 'vi',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  expires_at timestamp with time zone not null
);

create index if not exists idx_hub_landing_page_share_token
  on public.hub_landing_page_shares (share_token);

create index if not exists idx_hub_landing_page_share_expires
  on public.hub_landing_page_shares (expires_at);

alter table public.hub_landing_page_shares enable row level security;

create policy "Anyone can insert hub landing page share"
  on public.hub_landing_page_shares for insert
  with check (true);

create policy "Anyone can read active hub landing page share"
  on public.hub_landing_page_shares for select
  using (expires_at > timezone('utc'::text, now()));
