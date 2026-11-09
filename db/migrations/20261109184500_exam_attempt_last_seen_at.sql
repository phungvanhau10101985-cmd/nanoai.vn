-- Lần cuối trang bài thi còn báo đang mở. Server nộp nháp khi quá ngưỡng không thấy tín hiệu.

alter table public.exam_attempts
  add column if not exists last_seen_at timestamptz;

comment on column public.exam_attempts.last_seen_at is
  'Lần cuối bài thi tính điểm báo trang còn mở (UTC). Bài tập về nhà không dùng để nộp tự động.';

-- Lượt đang mở: cho một cửa sổ mới kể từ lúc chạy migration, không nộp ngay các bài đang làm.
update public.exam_attempts
set last_seen_at = now()
where submitted_at is null
  and last_seen_at is null;
