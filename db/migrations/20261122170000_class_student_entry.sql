-- Cửa vào lớp không cần email: một link của lớp, mỗi học sinh một mật khẩu 6 số in trên phiếu.

alter table public.classes
  add column if not exists student_entry_token text;

create unique index if not exists classes_student_entry_token_uidx
  on public.classes (student_entry_token)
  where student_entry_token is not null;

comment on column public.classes.student_entry_token is
  'Link công khai để học sinh vào lớp bằng mã định danh và mật khẩu trên phiếu.';

alter table public.class_roster_entries
  add column if not exists login_code text,
  add column if not exists login_fail_count integer not null default 0,
  add column if not exists login_locked_until timestamptz;

alter table public.class_roster_entries
  drop constraint if exists class_roster_entries_login_code_check;

alter table public.class_roster_entries
  add constraint class_roster_entries_login_code_check
  check (login_code is null or login_code ~ '^[0-9]{6}$');

comment on column public.class_roster_entries.login_code is
  'Mật khẩu 6 số in trên phiếu QR của học sinh. Giữ nguyên để em nhìn phiếu mà vào lớp.';
