-- Tối ưu truy vấn trung tâm tác vụ (/dashboard/tasks): user + processing, user + thời gian mới nhất
create index if not exists idx_try_on_history_user_processing
  on try_on_history (user_id)
  where status = 'processing';

create index if not exists idx_try_on_history_user_created_at
  on try_on_history (user_id, created_at desc);

-- Trung tâm tác vụ: danh sách worksheet_jobs theo user, mới nhất trước
create index if not exists idx_worksheet_jobs_user_created_at
  on worksheet_jobs (user_id, created_at desc);
