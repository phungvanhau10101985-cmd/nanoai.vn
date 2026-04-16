-- Giới tính khách & cache tư vấn: chỉ nam / nữ (bỏ other).

update public.messaging_guest_accounts
set gender = null
where gender = 'other';

delete from public.messaging_partner_product_consult_cache
where gender = 'other';

alter table public.messaging_guest_accounts
  drop constraint if exists messaging_guest_accounts_gender_chk;

alter table public.messaging_guest_accounts
  add constraint messaging_guest_accounts_gender_chk
  check (
    gender is null
    or gender in ('male', 'female')
  );

comment on column public.messaging_guest_accounts.gender is 'Giới tính khách: male | female.';

alter table public.messaging_partner_product_consult_cache
  drop constraint if exists messaging_partner_product_consult_cache_gender_chk;

alter table public.messaging_partner_product_consult_cache
  add constraint messaging_partner_product_consult_cache_gender_chk
  check (gender in ('male', 'female'));
