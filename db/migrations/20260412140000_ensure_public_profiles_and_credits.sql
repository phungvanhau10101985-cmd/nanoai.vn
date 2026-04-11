-- =============================================================================
-- Core: public.profiles + public.credits
-- =============================================================================
-- Dùng khi database chưa từng chạy 20240101000000_init.sql (local mới, restore
-- lệch, hoặc đã --mark-all-applied nhầm). CREATE IF NOT EXISTS: an toàn nếu
-- bảng đã có từ migrate cũ.
--
-- Sau khi merge: chạy `npm run db:migrate:push` trên mọi môi trường (dev/staging/prod).
-- =============================================================================

create table if not exists public.profiles (
  id uuid not null references auth.users (id) on delete cascade,
  updated_at timestamptz,
  username text,
  full_name text,
  avatar_url text,
  website text,
  role text not null default 'user',
  constraint profiles_pkey primary key (id),
  constraint profiles_username_unique unique (username),
  constraint profiles_username_length check (username is null or char_length(username) >= 3)
);

-- Khớp kiểu sau các migration đổi balance (numeric 10,2).
create table if not exists public.credits (
  user_id uuid not null references public.profiles (id) on delete cascade,
  balance numeric(10, 2) not null default 0,
  updated_at timestamptz not null default (timezone('utc'::text, now())),
  constraint credits_pkey primary key (user_id)
);

comment on table public.profiles is 'Hồ sơ + role app; id = auth.users.id.';
comment on table public.credits is 'Số dư credit; user_id = profiles.id.';
