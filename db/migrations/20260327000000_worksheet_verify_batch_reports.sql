-- Báo cáo lô verify phiếu bài tập (admin – chất lượng dữ liệu)
create table if not exists worksheet_verify_batch_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  finished_at timestamptz,
  status text not null default 'running'
    check (status in ('running', 'completed', 'failed', 'cancelled')),
  triggered_by uuid references auth.users(id) on delete set null,
  worksheets_planned int not null default 0,
  worksheets_processed int not null default 0,
  questions_marked_verified int not null default 0,
  questions_content_updated int not null default 0,
  questions_skipped_invalid int not null default 0,
  error_summary text,
  progress jsonb not null default '{}'::jsonb,
  details jsonb not null default '[]'::jsonb
);

create index idx_worksheet_verify_batch_reports_created
  on worksheet_verify_batch_reports (created_at desc);

comment on table worksheet_verify_batch_reports is 'Admin: báo cáo quét verify hàng loạt câu chưa có verified_at trên phiếu bài tập';

alter table worksheet_verify_batch_reports enable row level security;

create policy "worksheet_verify_reports_admin_select"
  on worksheet_verify_batch_reports for select
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "worksheet_verify_reports_admin_insert"
  on worksheet_verify_batch_reports for insert
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "worksheet_verify_reports_admin_update"
  on worksheet_verify_batch_reports for update
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Liệt kê phiếu có ít nhất một câu chưa verify (chỉ gọi bằng service_role / server)
create or replace function public.get_worksheet_ids_pending_verify()
returns table (worksheet_id uuid, worksheet_topic text)
language sql
stable
security definer
set search_path = public
as $$
  select w.id, coalesce(w.topic, '')::text
  from worksheet_worksheets w
  where w.question_ids is not null
    and cardinality(w.question_ids) > 0
    and exists (
      select 1 from worksheet_questions q
      where q.id = any (w.question_ids) and q.verified_at is null
    )
  order by w.created_at asc nulls last;
$$;

revoke all on function public.get_worksheet_ids_pending_verify() from public;
grant execute on function public.get_worksheet_ids_pending_verify() to service_role;
