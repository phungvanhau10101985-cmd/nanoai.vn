-- Guest chat auth: email OTP/magic link accounts + challenges + conversation linkage.

create table if not exists public.messaging_guest_accounts (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners(id) on delete cascade,
  email_raw text not null,
  email_normalized text not null,
  first_verified_at timestamptz not null default now(),
  last_login_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (partner_id, email_normalized)
);

create index if not exists idx_messaging_guest_accounts_partner
  on public.messaging_guest_accounts(partner_id);

create table if not exists public.messaging_guest_identities (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners(id) on delete cascade,
  guest_account_id uuid not null references public.messaging_guest_accounts(id) on delete cascade,
  provider text not null check (provider in ('google','email_otp')),
  provider_subject text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (partner_id, provider, provider_subject)
);

create index if not exists idx_messaging_guest_identities_account
  on public.messaging_guest_identities(guest_account_id);

create table if not exists public.messaging_guest_email_challenges (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners(id) on delete cascade,
  email_normalized text not null,
  session_id text not null,
  code_hash text not null,
  magic_token_hash text not null,
  expires_at timestamptz not null,
  attempt_count int not null default 0,
  consumed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_messaging_guest_email_challenges_lookup
  on public.messaging_guest_email_challenges(partner_id, email_normalized, session_id, created_at desc);

create index if not exists idx_messaging_guest_email_challenges_magic
  on public.messaging_guest_email_challenges(partner_id, email_normalized, session_id, magic_token_hash);

alter table public.customer_care_conversations
  add column if not exists guest_account_id uuid null references public.messaging_guest_accounts(id) on delete set null;

create index if not exists idx_customer_care_conversations_guest_account
  on public.customer_care_conversations(guest_account_id);
