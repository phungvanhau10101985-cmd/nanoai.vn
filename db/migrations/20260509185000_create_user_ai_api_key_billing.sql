begin;

create table if not exists public.user_ai_api_key_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_id text not null,
  status text not null default 'inactive',
  current_period_start timestamptz,
  current_period_end timestamptz,
  first_month_discount_used boolean not null default false,
  latest_payment_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_ai_api_key_subscriptions_plan_check check (plan_id in ('basic', 'pro', 'business')),
  constraint user_ai_api_key_subscriptions_status_check check (status in ('inactive', 'active', 'expired', 'cancelled'))
);

create table if not exists public.user_ai_api_key_plan_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null,
  amount integer not null,
  regular_amount integer not null,
  discount_percent integer not null default 0,
  period_months integer not null default 1,
  transaction_content text not null unique,
  bank_account text not null,
  bank_name text not null,
  qr_url text not null,
  status text not null default 'pending',
  transaction_id text,
  sepay_data jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_ai_api_key_plan_payments_plan_check check (plan_id in ('basic', 'pro', 'business')),
  constraint user_ai_api_key_plan_payments_status_check check (status in ('pending', 'completed', 'failed', 'cancelled')),
  constraint user_ai_api_key_plan_payments_amount_check check (amount >= 1000),
  constraint user_ai_api_key_plan_payments_regular_amount_check check (regular_amount >= amount),
  constraint user_ai_api_key_plan_payments_period_check check (period_months >= 1)
);

alter table public.user_ai_api_key_subscriptions
  drop constraint if exists user_ai_api_key_subscriptions_latest_payment_fk;
alter table public.user_ai_api_key_subscriptions
  add constraint user_ai_api_key_subscriptions_latest_payment_fk
  foreign key (latest_payment_id) references public.user_ai_api_key_plan_payments(id) on delete set null;

create index if not exists idx_user_ai_api_key_plan_payments_user_created
  on public.user_ai_api_key_plan_payments (user_id, created_at desc);

create index if not exists idx_user_ai_api_key_plan_payments_status
  on public.user_ai_api_key_plan_payments (status);

create index if not exists idx_user_ai_api_key_plan_payments_transaction_id
  on public.user_ai_api_key_plan_payments (transaction_id);

alter table public.user_ai_api_key_subscriptions enable row level security;
alter table public.user_ai_api_key_plan_payments enable row level security;

drop policy if exists "user_ai_api_key_subscriptions_select_own" on public.user_ai_api_key_subscriptions;
create policy "user_ai_api_key_subscriptions_select_own"
  on public.user_ai_api_key_subscriptions
  for select
  using (auth.uid() = user_id);

drop policy if exists "user_ai_api_key_plan_payments_select_own" on public.user_ai_api_key_plan_payments;
create policy "user_ai_api_key_plan_payments_select_own"
  on public.user_ai_api_key_plan_payments
  for select
  using (auth.uid() = user_id);

create or replace function public.trg_user_ai_api_key_billing_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_ai_api_key_subscriptions_set_updated_at on public.user_ai_api_key_subscriptions;
create trigger trg_user_ai_api_key_subscriptions_set_updated_at
  before update on public.user_ai_api_key_subscriptions
  for each row
  execute procedure public.trg_user_ai_api_key_billing_set_updated_at();

drop trigger if exists trg_user_ai_api_key_plan_payments_set_updated_at on public.user_ai_api_key_plan_payments;
create trigger trg_user_ai_api_key_plan_payments_set_updated_at
  before update on public.user_ai_api_key_plan_payments
  for each row
  execute procedure public.trg_user_ai_api_key_billing_set_updated_at();

comment on table public.user_ai_api_key_subscriptions is
  'BYOK platform subscription for users who use their own AI provider API keys.';

comment on table public.user_ai_api_key_plan_payments is
  'Pending/completed SePay payments for BYOK platform subscription plans.';

commit;
