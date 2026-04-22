create table if not exists public.guest_credit_trial_sessions (
  trial_id text primary key,
  fingerprint_hash text not null,
  ip_hash text not null,
  used_credits numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists idx_guest_trial_sessions_fp
  on public.guest_credit_trial_sessions (fingerprint_hash);

create index if not exists idx_guest_trial_sessions_ip
  on public.guest_credit_trial_sessions (ip_hash);

create table if not exists public.guest_credit_trial_events (
  id uuid primary key default gen_random_uuid(),
  trial_id text not null,
  fingerprint_hash text not null,
  ip_hash text not null,
  amount numeric(10,2) not null,
  event_key text null,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_guest_trial_events_event_key
  on public.guest_credit_trial_events (event_key)
  where event_key is not null;

create index if not exists idx_guest_trial_events_trial_created
  on public.guest_credit_trial_events (trial_id, created_at desc);

create index if not exists idx_guest_trial_events_fp_created
  on public.guest_credit_trial_events (fingerprint_hash, created_at desc);

create index if not exists idx_guest_trial_events_ip_created
  on public.guest_credit_trial_events (ip_hash, created_at desc);
