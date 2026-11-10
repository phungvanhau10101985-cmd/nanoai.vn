-- Ngày thu đủ học phí hàng tháng của lớp học thêm.
-- Lần đầu vẫn dùng tuition_due_after_days (ngày lịch sau khi vào lớp) và tính theo số ngày còn lại.

alter table public.classes
  add column if not exists tuition_billing_day integer;

update public.classes
set tuition_billing_day = 1
where class_kind = 'tutoring'
  and tuition_billing_day is null;

alter table public.classes
  drop constraint if exists classes_tutoring_tuition_check;

alter table public.classes
  add constraint classes_tutoring_tuition_check
  check (
    class_kind <> 'tutoring'
    or (
      school_id is null
      and tuition_monthly_vnd between 1000 and 100000000
      and tuition_due_after_days between 0 and 365
      and tuition_billing_day between 1 and 31
      and tuition_bank_bin ~ '^[0-9]{6,8}$'
      and char_length(btrim(coalesce(tuition_bank_name, ''))) between 1 and 80
      and tuition_account_no ~ '^[0-9]{6,20}$'
      and char_length(btrim(coalesce(tuition_account_name, ''))) between 2 and 80
    )
  );

comment on column public.classes.tuition_billing_day is
  'Ngày trong tháng (1-31) thu đủ học phí từ tháng sau khi vào lớp. Tháng ngắn hơn thì lấy ngày cuối.';

comment on column public.classes.tuition_due_after_days is
  'Số ngày lịch sau ngày vào lớp thì lần đầu phải đóng. Quá hạn chưa xác nhận thì không vào lớp.';

insert into public.app_applied_sql_migrations (migration_filename)
values ('20261110170000_class_tutoring_billing_day.sql')
on conflict (migration_filename) do nothing;
