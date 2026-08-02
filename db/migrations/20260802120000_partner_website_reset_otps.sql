-- OTP xác nhận reset/xóa website partner để tạo lại từ đầu.

create table if not exists public.messaging_partner_website_reset_otps (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  otp_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_messaging_partner_website_reset_otps_partner
  on public.messaging_partner_website_reset_otps (partner_id);

comment on table public.messaging_partner_website_reset_otps is 'OTP một lần để reset/xóa website partner (chỉ server qua DATABASE_URL).';
