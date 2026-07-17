-- Chia sẻ mockup 3D hộp bao bì — link công khai xoay tương tác (hết hạn sau 30 ngày)

create table if not exists public.packaging_mockup_shares (
  id uuid default gen_random_uuid() primary key,
  share_token text not null unique,
  user_id uuid,
  dimensions_mm jsonb not null,
  face_urls jsonb not null default '{}'::jsonb,
  locale text not null default 'vi',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  expires_at timestamp with time zone not null
);

create index if not exists idx_packaging_mockup_share_token
  on public.packaging_mockup_shares (share_token);

create index if not exists idx_packaging_mockup_share_expires
  on public.packaging_mockup_shares (expires_at);

alter table public.packaging_mockup_shares enable row level security;

create policy "Anyone can insert packaging mockup share"
  on public.packaging_mockup_shares for insert
  with check (true);

create policy "Anyone can read active packaging mockup share"
  on public.packaging_mockup_shares for select
  using (expires_at > timezone('utc'::text, now()));
