-- OTP một lần cho admin xóa tài khoản thành viên (mỗi lần xóa cần OTP mới).

create table if not exists public.admin_user_deletion_otps (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users (id) on delete cascade,
  target_user_id uuid not null references auth.users (id) on delete cascade,
  otp_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_user_deletion_otps_admin_target
  on public.admin_user_deletion_otps (admin_user_id, target_user_id, created_at desc);

comment on table public.admin_user_deletion_otps is 'OTP 6 số — admin xóa user; mỗi lần xóa gửi OTP mới tới email admin.';
