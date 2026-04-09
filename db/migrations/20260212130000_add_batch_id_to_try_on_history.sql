-- Thêm batch_id để nhóm các ảnh dịch cùng lúc (xem tiến trình)
alter table try_on_history add column if not exists batch_id uuid;

create index if not exists idx_try_on_history_batch_id on try_on_history(batch_id);
