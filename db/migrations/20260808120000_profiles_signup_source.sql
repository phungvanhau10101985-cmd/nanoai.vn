-- Nơi tạo tài khoản NanoAI (admin users): nanoai | customer_website | partner_website.
-- Chỉ ghi lần đầu (app set khi isNewUser); không ghi đè.

alter table public.profiles
  add column if not exists signup_source text null;

alter table public.profiles
  add column if not exists signup_partner_id uuid null;

alter table public.profiles
  add column if not exists signup_partner_slug text null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_signup_source_chk'
  ) then
    alter table public.profiles
      add constraint profiles_signup_source_chk
      check (
        signup_source is null
        or signup_source in ('nanoai', 'customer_website', 'partner_website')
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_signup_partner_id_fkey'
  ) then
    alter table public.profiles
      add constraint profiles_signup_partner_id_fkey
      foreign key (signup_partner_id)
      references public.messaging_partners (id)
      on delete set null;
  end if;
exception
  when undefined_table then
    null;
end $$;

create index if not exists idx_profiles_signup_source
  on public.profiles (signup_source)
  where signup_source is not null;

comment on column public.profiles.signup_source is
  'Nơi tạo tài khoản lần đầu: nanoai | customer_website (web khách /site) | partner_website (web đối tác / chat widget / SSO).';
comment on column public.profiles.signup_partner_id is
  'Partner liên quan khi tạo từ web khách hoặc web đối tác (nullable).';
comment on column public.profiles.signup_partner_slug is
  'Slug partner (denormalized) để hiển thị admin khi FK partner đã xóa.';
