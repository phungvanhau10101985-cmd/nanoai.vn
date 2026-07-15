-- OTP step-up xác minh lại trước thao tác nhạy cảm (admin / tài khoản khách).

create table if not exists public.user_step_up_otps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null check (scope in ('admin', 'account')),
  otp_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists idx_user_step_up_otps_user_scope
  on public.user_step_up_otps (user_id, scope, created_at desc);

create table if not exists public.user_step_up_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null check (scope in ('admin', 'account')),
  verified_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (user_id, scope)
);

create index if not exists idx_user_step_up_sessions_expires
  on public.user_step_up_sessions (expires_at);

comment on table public.user_step_up_otps is 'OTP 6 số chờ xác minh step-up (admin hoặc account).';
comment on table public.user_step_up_sessions is 'Phiên step-up đã xác minh OTP — cho phép thao tác nhạy cảm trong TTL.';
