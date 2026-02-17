-- Cho phép status 'cancelled' trong translate_jobs
alter table translate_jobs drop constraint if exists translate_jobs_status_check;
alter table translate_jobs add constraint translate_jobs_status_check
  check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled'));

-- Cho phép status 'cancelled' trong try_on_history
alter type try_on_status add value if not exists 'cancelled';
