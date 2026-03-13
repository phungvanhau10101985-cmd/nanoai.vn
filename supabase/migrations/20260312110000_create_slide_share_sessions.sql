-- Chia sẻ slide tạm thời – link + QR cho học sinh xem
-- Dữ liệu hết hạn sau 24h

create table if not exists slide_share_sessions (
  id uuid default gen_random_uuid() primary key,
  share_code text not null unique,
  content text,
  topic text,
  slides jsonb not null default '[]',
  slide_mode text,
  curriculum_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  expires_at timestamp with time zone not null
);

create index idx_slide_share_code on slide_share_sessions(share_code);
create index idx_slide_share_expires on slide_share_sessions(expires_at);

-- Cho phép ai cũng tạo và đọc (public share)
alter table slide_share_sessions enable row level security;

create policy "Anyone can insert slide share"
  on slide_share_sessions for insert
  with check (true);

create policy "Anyone can read slide share by code"
  on slide_share_sessions for select
  using (expires_at > timezone('utc'::text, now()));
