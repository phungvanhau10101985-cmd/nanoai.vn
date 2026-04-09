-- Học tiếng Anh AI: lưu hồ sơ learner trên profiles (JWT / không còn user_metadata Auth hosted).

alter table public.profiles
  add column if not exists english_coach_job text;

alter table public.profiles
  add column if not exists english_coach_city text;

alter table public.profiles
  add column if not exists english_coach_age integer;

alter table public.profiles
  add column if not exists english_coach_gender text;

comment on column public.profiles.english_coach_job is 'English coach: nghề (cá nhân hóa), đọc/ghi qua API.';
comment on column public.profiles.english_coach_city is 'English coach: thành phố.';
comment on column public.profiles.english_coach_age is 'English coach: tuổi (1–120).';
comment on column public.profiles.english_coach_gender is 'English coach: male | female | other.';

do $$
begin
  alter table public.profiles
    add constraint profiles_english_coach_age_chk
    check (english_coach_age is null or (english_coach_age >= 1 and english_coach_age <= 120));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.profiles
    add constraint profiles_english_coach_gender_chk
    check (
      english_coach_gender is null
      or english_coach_gender in ('male', 'female', 'other')
    );
exception
  when duplicate_object then null;
end $$;
