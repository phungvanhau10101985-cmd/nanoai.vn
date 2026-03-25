-- Giới thiệu bạn bè: mỗi người được mời (đăng ký mới trong 30 ngày) nhận +2 credit, người mời +2 credit. Một lần / invitee.

create table if not exists public.referral_claims (
  invitee_user_id uuid not null primary key references auth.users (id) on delete cascade,
  inviter_user_id uuid not null references auth.users (id) on delete cascade,
  bonus_per_side numeric(10,2) not null default 2,
  created_at timestamptz not null default now(),
  constraint referral_claims_no_self check (invitee_user_id <> inviter_user_id)
);

create index if not exists referral_claims_inviter_idx on public.referral_claims (inviter_user_id);

alter table public.referral_claims enable row level security;

create policy "Users can view own referral claim as invitee"
  on public.referral_claims for select
  using (auth.uid() = invitee_user_id);

create policy "Users can view referrals they invited"
  on public.referral_claims for select
  using (auth.uid() = inviter_user_id);

comment on table public.referral_claims is 'Một dòng / người được mời; cộng credit cho invitee + inviter khi claim thành công.';

-- Gọi bằng JWT hiện tại (invitee = auth.uid()). Idempotent nếu đã claim.
create or replace function public.claim_referral_bonus(p_inviter uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitee uuid := auth.uid();
  v_created timestamptz;
  v_inserted int;
  v_bonus numeric(10,2) := 2;
begin
  if v_invitee is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  if p_inviter is null then
    return jsonb_build_object('ok', false, 'error', 'missing_inviter');
  end if;
  if p_inviter = v_invitee then
    return jsonb_build_object('ok', false, 'error', 'self_referral');
  end if;
  if not exists (select 1 from auth.users where id = p_inviter) then
    return jsonb_build_object('ok', false, 'error', 'invalid_inviter');
  end if;

  select u.created_at into v_created from auth.users u where u.id = v_invitee;
  if v_created is null then
    return jsonb_build_object('ok', false, 'error', 'no_invitee');
  end if;
  if (now() - v_created) > interval '30 days' then
    return jsonb_build_object('ok', false, 'error', 'account_too_old');
  end if;

  insert into public.referral_claims (invitee_user_id, inviter_user_id, bonus_per_side)
  values (v_invitee, p_inviter, v_bonus)
  on conflict (invitee_user_id) do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return jsonb_build_object('ok', true, 'applied', false, 'reason', 'already_claimed');
  end if;

  insert into public.credits (user_id, balance) values (v_invitee, 0) on conflict (user_id) do nothing;
  insert into public.credits (user_id, balance) values (p_inviter, 0) on conflict (user_id) do nothing;

  update public.credits
  set balance = round((balance + v_bonus)::numeric, 2), updated_at = now()
  where user_id = v_invitee;

  update public.credits
  set balance = round((balance + v_bonus)::numeric, 2), updated_at = now()
  where user_id = p_inviter;

  insert into public.transactions (user_id, amount, type, status, description)
  values
    (v_invitee, round(v_bonus)::int, 'deposit', 'completed', 'referral_invitee_bonus'),
    (p_inviter, round(v_bonus)::int, 'deposit', 'completed', 'referral_inviter_bonus');

  return jsonb_build_object('ok', true, 'applied', true, 'bonus', v_bonus);
end;
$$;

revoke all on function public.claim_referral_bonus(uuid) from public;
grant execute on function public.claim_referral_bonus(uuid) to authenticated;
