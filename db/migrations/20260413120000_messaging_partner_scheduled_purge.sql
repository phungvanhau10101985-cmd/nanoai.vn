-- Lên lịch xóa workspace: grace 7 ngày, OTP; trong grace ngừng nhận tin (purge_at set); cron hoàn tất soft-delete.

alter table public.messaging_partners
  add column if not exists purge_at timestamptz null,
  add column if not exists deletion_requested_at timestamptz null;

comment on column public.messaging_partners.purge_at is 'Khi khác null: shop ngừng nhận tin; khi <= now() cron đặt is_active=false.';
comment on column public.messaging_partners.deletion_requested_at is 'Thời điểm chủ shop xác nhận OTP lên lịch xóa (audit).';

create index if not exists idx_messaging_partners_purge_at_due
  on public.messaging_partners (purge_at)
  where purge_at is not null and coalesce(is_active, true) = true;

create table if not exists public.messaging_partner_deletion_otps (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  otp_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_messaging_partner_deletion_otps_partner
  on public.messaging_partner_deletion_otps (partner_id);

comment on table public.messaging_partner_deletion_otps is 'OTP một lần để lên lịch xóa workspace (chỉ server qua DATABASE_URL).';
