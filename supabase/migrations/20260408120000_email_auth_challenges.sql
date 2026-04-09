-- Đăng nhập email: OTP + magic link (app tự gửi SMTP). User lưu trong auth.users (trigger tạo profiles/credits).

create extension if not exists pgcrypto;

create table if not exists public.nanoai_email_login_challenges (
  id uuid primary key default gen_random_uuid(),
  email_normalized text not null,
  otp_hash text not null,
  magic_token_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_nanoai_email_challenges_email_created
  on public.nanoai_email_login_challenges (email_normalized, created_at desc);

comment on table public.nanoai_email_login_challenges is 'OTP + magic link đăng nhập — hash SHA-256 hex, không lưu plaintext.';

-- Tạo hoặc trả về user id trong auth.users (trigger handle_new_user → profiles + credits).
create or replace function public.nanoai_ensure_user_by_email(p_email text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_id uuid;
  v_inst uuid;
  v_hash text;
  v_email text := lower(trim(p_email));
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_email';
  end if;

  select u.id into v_id from auth.users u where lower(u.email) = v_email limit 1;
  if v_id is not null then
    return v_id;
  end if;

  select i.id into v_inst from auth.instances i limit 1;
  if v_inst is null then
    raise exception 'auth.instances_empty';
  end if;

  v_id := gen_random_uuid();
  v_hash := crypt(encode(gen_random_bytes(24), 'hex'), gen_salt('bf'));

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  ) values (
    v_inst,
    v_id,
    'authenticated',
    'authenticated',
    v_email,
    v_hash,
    now(),
    '{}',
    '{}',
    now(),
    now()
  );

  return v_id;
exception
  when unique_violation then
    select u.id into v_id from auth.users u where lower(u.email) = v_email limit 1;
    if v_id is null then
      raise;
    end if;
    return v_id;
end;
$$;
