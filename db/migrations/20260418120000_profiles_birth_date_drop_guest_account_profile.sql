-- Hồ sơ ngày sinh / giới tính widget: một lần trên tài khoản NanoAI (`profiles`), không theo shop.

alter table public.profiles add column if not exists birth_date date null;

comment on column public.profiles.birth_date is 'Ngày sinh hệ thống NanoAI (widget chat — xưng hô; một lần cho cả nền tảng).';
comment on column public.profiles.gender is 'Giới tính hệ thống NanoAI (nam/nữ — widget chat; một lần cho cả nền tảng).';

alter table public.messaging_guest_accounts drop constraint if exists messaging_guest_accounts_gender_chk;

alter table public.messaging_guest_accounts drop column if exists birth_date;
alter table public.messaging_guest_accounts drop column if exists gender;
