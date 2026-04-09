alter table public.profiles add column if not exists gender text;

do $$
begin
  alter table public.profiles
    add constraint profiles_gender_chk
    check (gender is null or gender in ('male', 'female'));
exception
  when duplicate_object then null;
end $$;

comment on column public.profiles.gender is 'Giới tính UI (nam/nữ), không dùng metadata Auth hosted.';
