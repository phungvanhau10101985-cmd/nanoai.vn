-- Support quarter-credit charging (e.g., 1.25) and atomic idempotent deductions.
alter table public.credits
alter column balance type numeric(10,2)
using balance::numeric(10,2);

alter table public.credits
alter column balance set default 0;

create table if not exists public.language_coach_credit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid,
  event_key text not null unique,
  charge_type text not null,
  amount numeric(10,2) not null check (amount > 0),
  metadata_json text,
  created_at timestamptz not null default now()
);

create index if not exists idx_language_coach_credit_events_user_created
  on public.language_coach_credit_events(user_id, created_at desc);

create index if not exists idx_language_coach_credit_events_user_session
  on public.language_coach_credit_events(user_id, session_id, created_at desc);

create or replace function public.spend_credits_idempotent(
  p_user_id uuid,
  p_amount numeric,
  p_event_key text,
  p_charge_type text,
  p_session_id uuid default null,
  p_metadata_json text default null
)
returns table (
  ok boolean,
  already_applied boolean,
  new_balance numeric,
  error text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance numeric(10,2);
begin
  if p_user_id is null then
    return query select false, false, null::numeric, 'missing_user_id';
    return;
  end if;
  if coalesce(trim(p_event_key), '') = '' then
    return query select false, false, null::numeric, 'missing_event_key';
    return;
  end if;
  if coalesce(trim(p_charge_type), '') = '' then
    return query select false, false, null::numeric, 'missing_charge_type';
    return;
  end if;
  if coalesce(p_amount, 0) <= 0 then
    return query select false, false, null::numeric, 'invalid_amount';
    return;
  end if;

  -- Idempotency first.
  if exists (
    select 1
    from public.language_coach_credit_events
    where event_key = p_event_key
  ) then
    select c.balance into v_balance
    from public.credits c
    where c.user_id = p_user_id;
    return query select true, true, coalesce(v_balance, 0)::numeric, null::text;
    return;
  end if;

  -- Ensure balance row exists.
  insert into public.credits (user_id, balance)
  values (p_user_id, 0)
  on conflict (user_id) do nothing;

  -- Lock credit row for atomic check-and-deduct.
  select c.balance
  into v_balance
  from public.credits c
  where c.user_id = p_user_id
  for update;

  if v_balance < p_amount then
    return query select false, false, v_balance::numeric, 'insufficient_credits';
    return;
  end if;

  update public.credits
  set
    balance = round((balance - p_amount)::numeric, 2),
    updated_at = now()
  where user_id = p_user_id
  returning balance into v_balance;

  begin
    insert into public.language_coach_credit_events (
      user_id,
      session_id,
      event_key,
      charge_type,
      amount,
      metadata_json
    )
    values (
      p_user_id,
      p_session_id,
      p_event_key,
      p_charge_type,
      round(p_amount::numeric, 2),
      p_metadata_json
    );
  exception
    when unique_violation then
      -- Another request won the same idempotency key.
      select c.balance into v_balance
      from public.credits c
      where c.user_id = p_user_id;
      return query select true, true, coalesce(v_balance, 0)::numeric, null::text;
      return;
  end;

  return query select true, false, v_balance::numeric, null::text;
end;
$$;
