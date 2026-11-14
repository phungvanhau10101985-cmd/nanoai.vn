-- Dừng tiến trình dịch: job pending chuyển sang paused, trang đã xong giữ completed.
alter table translate_jobs drop constraint if exists translate_jobs_status_check;
alter table translate_jobs add constraint translate_jobs_status_check
  check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled', 'paused'));
