-- Ngày sinh + giới tính khách (widget) — xưng hô & ngữ cảnh tư vấn AI.

alter table public.messaging_guest_accounts
  add column if not exists birth_date date null,
  add column if not exists gender text null;

alter table public.messaging_guest_accounts
  drop constraint if exists messaging_guest_accounts_gender_chk;

alter table public.messaging_guest_accounts
  add constraint messaging_guest_accounts_gender_chk
  check (
    gender is null
    or gender in ('male', 'female', 'other')
  );

comment on column public.messaging_guest_accounts.birth_date is 'Sinh nhật khách (widget) — phục vụ xưng hô / gợi ý tuổi.';
comment on column public.messaging_guest_accounts.gender is 'Giới tính khách: male | female | other.';
