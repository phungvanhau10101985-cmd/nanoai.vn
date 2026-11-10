-- Lớp học thêm: không gắn trường, học phí theo tháng, cô giáo xác nhận tay.

alter table public.classes
  add column if not exists class_kind text,
  add column if not exists tuition_monthly_vnd integer,
  add column if not exists tuition_due_after_days integer,
  add column if not exists tuition_bank_bin text,
  add column if not exists tuition_bank_name text,
  add column if not exists tuition_account_no text,
  add column if not exists tuition_account_name text;

update public.classes
   set class_kind = 'school'
 where class_kind is null
    or class_kind not in ('school', 'tutoring');

alter table public.classes
  alter column class_kind set default 'school';

alter table public.classes
  alter column class_kind set not null;

alter table public.classes
  drop constraint if exists classes_class_kind_check;

alter table public.classes
  add constraint classes_class_kind_check
  check (class_kind in ('school', 'tutoring'));

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
      and tuition_bank_bin ~ '^[0-9]{6,8}$'
      and char_length(btrim(coalesce(tuition_bank_name, ''))) between 1 and 80
      and tuition_account_no ~ '^[0-9]{6,20}$'
      and char_length(btrim(coalesce(tuition_account_name, ''))) between 2 and 80
    )
  );

comment on column public.classes.class_kind is 'school = lớp trên trường; tutoring = lớp học thêm, không gắn trường';
comment on column public.classes.tuition_monthly_vnd is 'Học phí một tháng (đồng) của lớp học thêm';
comment on column public.classes.tuition_due_after_days is 'Số ngày sau khi học sinh vào lớp thì yêu cầu đóng học phí';
comment on column public.classes.tuition_bank_bin is 'Mã BIN ngân hàng nhận học phí (VietQR)';
comment on column public.classes.tuition_account_no is 'Số tài khoản cô giáo nhận học phí';

create index if not exists idx_classes_teacher_kind
  on public.classes (teacher_id, class_kind);

create table if not exists public.class_tuition_payments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  period_month date not null,
  confirmed_at timestamptz not null default now(),
  confirmed_by uuid references auth.users(id) on delete set null,
  unique (class_id, user_id, period_month)
);

comment on table public.class_tuition_payments is 'Học phí lớp học thêm — cô giáo xác nhận tay từng tháng, không đối soát ngân hàng';

alter table public.class_tuition_payments enable row level security;

drop policy if exists "Teacher manages tuition of own class" on public.class_tuition_payments;
create policy "Teacher manages tuition of own class"
  on public.class_tuition_payments for all
  using (
    exists (
      select 1 from public.classes c
      where c.id = class_id and c.teacher_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.classes c
      where c.id = class_id and c.teacher_id = auth.uid()
    )
  );

drop policy if exists "Student reads own tuition confirmation" on public.class_tuition_payments;
create policy "Student reads own tuition confirmation"
  on public.class_tuition_payments for select
  using (user_id = auth.uid());
