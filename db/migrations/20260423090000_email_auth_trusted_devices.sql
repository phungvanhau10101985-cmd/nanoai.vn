create extension if not exists pgcrypto;

create table if not exists public.nanoai_email_trusted_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  email_normalized text not null,
  token_hash text not null,
  expires_at timestamptz not null,
  created_ip_hash text,
  user_agent_hash text,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_nanoai_email_trusted_devices_email
  on public.nanoai_email_trusted_devices (email_normalized);

create index if not exists idx_nanoai_email_trusted_devices_user
  on public.nanoai_email_trusted_devices (user_id, created_at desc);

create index if not exists idx_nanoai_email_trusted_devices_exp
  on public.nanoai_email_trusted_devices (expires_at);

comment on table public.nanoai_email_trusted_devices is
  'Trusted devices for email OTP sign-in; stores only hashed token.';
