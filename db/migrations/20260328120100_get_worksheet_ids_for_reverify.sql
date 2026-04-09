-- Phiếu có ít nhất một câu đã từng verify (để chạy verify lại với logic/prompt mới)
-- Version 20260328120100: tránh trùng 20260328120000 với exam_attempt_layout_snapshot (bảng registry migration — PK theo version).
create or replace function public.get_worksheet_ids_for_reverify()
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
      where q.id = any (w.question_ids) and q.verified_at is not null
    )
  order by w.created_at asc nulls last;
$$;

comment on function public.get_worksheet_ids_for_reverify() is 'Admin: phiếu có ≥1 câu đã có verified_at — dùng cho lượt verify lại';

revoke all on function public.get_worksheet_ids_for_reverify() from public;
grant execute on function public.get_worksheet_ids_for_reverify() to service_role;
