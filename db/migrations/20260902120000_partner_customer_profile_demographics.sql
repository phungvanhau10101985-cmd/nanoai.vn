-- Hồ sơ shop: giới tính + ngày sinh (cohort lưới đề xuất, UX 188).

alter table public.messaging_partner_customer_profiles
  add column if not exists gender text,
  add column if not exists date_of_birth date;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'messaging_partner_customer_profiles_gender_check'
  ) then
    alter table public.messaging_partner_customer_profiles
      add constraint messaging_partner_customer_profiles_gender_check
      check (gender is null or gender in ('male', 'female'));
  end if;
end
$$;
