-- Nhật ký trừ/hoàn credit theo tính năng (thống kê admin ngày / tháng / năm).
create table if not exists public.credit_spend_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null,
  amount numeric(10,2) not null,
  source text not null default 'deduct',
  created_at timestamptz not null default now()
);

create index if not exists idx_credit_spend_events_created
  on public.credit_spend_events(created_at desc);

create index if not exists idx_credit_spend_events_feature_created
  on public.credit_spend_events(feature, created_at desc);

create index if not exists idx_credit_spend_events_user_created
  on public.credit_spend_events(user_id, created_at desc);

comment on table public.credit_spend_events is
  'Nhật ký trừ (+) / hoàn (-) credit theo tính năng. Admin thống kê sử dụng.';

-- Dual-write từ spend_credits_idempotent (coach / giáo trình / gói tháng).
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

  insert into public.credits (user_id, balance)
  values (p_user_id, 0)
  on conflict (user_id) do nothing;

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
      select c.balance into v_balance
      from public.credits c
      where c.user_id = p_user_id;
      return query select true, true, coalesce(v_balance, 0)::numeric, null::text;
      return;
  end;

  insert into public.credit_spend_events (user_id, feature, amount, source)
  values (
    p_user_id,
    p_charge_type,
    round(p_amount::numeric, 2),
    'idempotent'
  );

  return query select true, false, v_balance::numeric, null::text;
end;
$$;

-- Backfill sự kiện coach / giáo trình đã trừ trước khi có bảng mới.
insert into public.credit_spend_events (user_id, feature, amount, source, created_at)
select e.user_id, e.charge_type, e.amount, 'idempotent', e.created_at
from public.language_coach_credit_events e
where not exists (
  select 1
  from public.credit_spend_events s
  where s.user_id = e.user_id
    and s.feature = e.charge_type
    and s.amount = e.amount
    and s.source = 'idempotent'
    and s.created_at = e.created_at
);
