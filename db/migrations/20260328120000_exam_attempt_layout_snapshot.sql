-- Khóa phiên làm bài: một dòng attempt / user / session; snapshot thứ tự câu + permute đáp án khi bắt đầu

alter table public.exam_attempts
  add column if not exists layout_snapshot jsonb;

comment on column public.exam_attempts.layout_snapshot is
  'JSON: { v, questionOrder, optionPerms } — cố định sau khi HS bấm Bắt đầu; submitted_at null = đang làm';

create unique index if not exists exam_attempts_unique_session_user
  on public.exam_attempts (session_id, user_id)
  where user_id is not null;
