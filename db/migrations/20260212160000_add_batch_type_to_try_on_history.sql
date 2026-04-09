-- Phân biệt batch ảnh vs batch PDF để tải zip hoặc PDF
alter table try_on_history add column if not exists batch_type text default 'image';
create index if not exists idx_try_on_history_batch_type on try_on_history(batch_type);
