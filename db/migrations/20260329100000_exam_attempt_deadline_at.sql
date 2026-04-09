-- Mốc hết giờ làm bài trên server (bắt đầu tính khi HS bấm Bắt đầu)

alter table public.exam_attempts
  add column if not exists deadline_at timestamptz;

comment on column public.exam_attempts.deadline_at is
  'Hết giờ làm bài (UTC); đồng hồ trừ kể cả khi HS đóng trang';

-- Bản ghi đang làm chưa có deadline: suy ra từ started_at + duration phiên (best-effort)
update public.exam_attempts ea
set deadline_at = ea.started_at + (coalesce(es.duration_minutes, 15) * interval '1 minute')
from public.exam_sessions es
where ea.session_id = es.id
  and ea.submitted_at is null
  and ea.started_at is not null
  and ea.deadline_at is null;
