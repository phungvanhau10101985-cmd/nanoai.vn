-- Affiliate wallet / CTV giống 188: hồ sơ duyệt, ví, STK OTP, rút tiền, first-touch.
-- Additive. Không đụng shop đang có commission pending/confirmed.

alter table public.messaging_partner_affiliate_settings
  add column if not exists commission_policy text;

alter table public.messaging_partner_affiliate_settings
  alter column commission_percent set default 10;

alter table public.messaging_partner_affiliate_settings
  alter column minimum_payout_amount set default 100000;

alter table public.messaging_partner_affiliate_profiles
  add column if not exists referred_by_profile_id uuid
    references public.messaging_partner_affiliate_profiles (id) on delete set null;

alter table public.messaging_partner_affiliate_profiles
  add column if not exists referred_at timestamptz;

create index if not exists idx_partner_affiliate_profiles_referred_by
  on public.messaging_partner_affiliate_profiles (partner_id, referred_by_profile_id)
  where referred_by_profile_id is not null;

create table if not exists public.messaging_partner_affiliate_applications (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  affiliate_profile_id uuid not null references public.messaging_partner_affiliate_profiles (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  social_links jsonb not null default '[]'::jsonb,
  note text,
  admin_note text,
  reviewed_by uuid,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (partner_id, affiliate_profile_id)
);

create index if not exists idx_partner_affiliate_applications_status
  on public.messaging_partner_affiliate_applications (partner_id, status, submitted_at desc);

create table if not exists public.messaging_partner_affiliate_wallets (
  affiliate_profile_id uuid primary key
    references public.messaging_partner_affiliate_profiles (id) on delete cascade,
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  balance numeric(14,2) not null default 0,
  pending_balance numeric(14,2) not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists idx_partner_affiliate_wallets_partner
  on public.messaging_partner_affiliate_wallets (partner_id);

create table if not exists public.messaging_partner_affiliate_wallet_txs (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  affiliate_profile_id uuid not null
    references public.messaging_partner_affiliate_profiles (id) on delete cascade,
  tx_type text not null,
  amount numeric(14,2) not null,
  balance_after numeric(14,2) not null default 0,
  pending_after numeric(14,2) not null default 0,
  reference_type text,
  reference_id text,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists idx_partner_affiliate_wallet_txs_profile
  on public.messaging_partner_affiliate_wallet_txs
  (partner_id, affiliate_profile_id, created_at desc);

create table if not exists public.messaging_partner_affiliate_bank_accounts (
  affiliate_profile_id uuid primary key
    references public.messaging_partner_affiliate_profiles (id) on delete cascade,
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  bank_name text not null,
  bank_account text not null,
  account_holder text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.messaging_partner_affiliate_bank_otps (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  affiliate_profile_id uuid not null
    references public.messaging_partner_affiliate_profiles (id) on delete cascade,
  purpose text not null default 'bank_account'
    check (purpose in ('bank_account', 'withdraw')),
  email text not null,
  otp_hash text not null,
  payload_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_partner_affiliate_bank_otps_open
  on public.messaging_partner_affiliate_bank_otps
  (affiliate_profile_id, purpose, expires_at)
  where consumed_at is null;

create table if not exists public.messaging_partner_affiliate_withdrawals (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  affiliate_profile_id uuid not null
    references public.messaging_partner_affiliate_profiles (id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  bank_name text not null,
  bank_account text not null,
  account_holder text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  processed_by uuid,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists idx_partner_affiliate_withdrawals_status
  on public.messaging_partner_affiliate_withdrawals (partner_id, status, created_at desc);

alter table public.messaging_partner_orders
  add column if not exists wallet_amount_used numeric(14,2) not null default 0
    check (wallet_amount_used >= 0);

alter table public.messaging_partner_orders
  add column if not exists referrer_profile_id uuid
    references public.messaging_partner_affiliate_profiles (id) on delete set null;

create index if not exists idx_partner_orders_referrer_profile
  on public.messaging_partner_orders (partner_id, referrer_profile_id)
  where referrer_profile_id is not null;

alter table public.messaging_partner_affiliate_commissions
  drop constraint if exists messaging_partner_affiliate_commissions_status_check;

alter table public.messaging_partner_affiliate_commissions
  add constraint messaging_partner_affiliate_commissions_status_check
  check (status in ('pending', 'confirmed', 'reversed', 'cancelled', 'paid'));

alter table public.messaging_partner_affiliate_settings enable row level security;
alter table public.messaging_partner_affiliate_profiles enable row level security;
alter table public.messaging_partner_affiliate_applications enable row level security;
alter table public.messaging_partner_affiliate_wallets enable row level security;
alter table public.messaging_partner_affiliate_wallet_txs enable row level security;
alter table public.messaging_partner_affiliate_bank_accounts enable row level security;
alter table public.messaging_partner_affiliate_bank_otps enable row level security;
alter table public.messaging_partner_affiliate_withdrawals enable row level security;

drop policy if exists "Partner affiliate applications owners manage." on public.messaging_partner_affiliate_applications;
create policy "Partner affiliate applications owners manage."
  on public.messaging_partner_affiliate_applications for all
  using (
    partner_id in (
      select id from public.messaging_partners where owner_user_id = auth.uid()
    )
  )
  with check (
    partner_id in (
      select id from public.messaging_partners where owner_user_id = auth.uid()
    )
  );

drop policy if exists "Partner affiliate wallets owners read." on public.messaging_partner_affiliate_wallets;
create policy "Partner affiliate wallets owners read."
  on public.messaging_partner_affiliate_wallets for select
  using (
    partner_id in (
      select id from public.messaging_partners where owner_user_id = auth.uid()
    )
  );

drop policy if exists "Partner affiliate withdrawals owners manage." on public.messaging_partner_affiliate_withdrawals;
create policy "Partner affiliate withdrawals owners manage."
  on public.messaging_partner_affiliate_withdrawals for all
  using (
    partner_id in (
      select id from public.messaging_partners where owner_user_id = auth.uid()
    )
  )
  with check (
    partner_id in (
      select id from public.messaging_partners where owner_user_id = auth.uid()
    )
  );
