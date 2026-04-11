-- API route dùng service role + user.id từ getUserForAction — không cần cookie JWT trong RPC.
-- Chỉ service_role được gọi; logic giống claim_referral_bonus(uuid) nhưng invitee truyền rõ.

create or replace function public.claim_referral_bonus_server(p_inviter uuid, p_invitee uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitee uuid := p_invitee;
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

  insert into public.credits (user_id, balance) values (p_inviter, 0) on conflict (user_id) do nothing;

  update public.credits
  set balance = round((balance + v_bonus)::numeric, 2), updated_at = now()
  where user_id = p_inviter;

  insert into public.transactions (user_id, amount, type, status, description)
  values (p_inviter, round(v_bonus)::int, 'deposit', 'completed', 'referral_inviter_bonus');

  return jsonb_build_object(
    'ok', true,
    'applied', true,
    'bonus_inviter', v_bonus,
    'invitee_credited', false
  );
end;
$$;

revoke all on function public.claim_referral_bonus_server(uuid, uuid) from public;
grant execute on function public.claim_referral_bonus_server(uuid, uuid) to service_role;
grant execute on function public.claim_referral_bonus_server(uuid, uuid) to postgres;
