-- Lưu tỷ lệ ảnh (vd: "1:1", "16:9") để xuất PDF chuẩn in đúng khổ
alter table try_on_history add column if not exists aspect_ratio text;
create index if not exists idx_try_on_history_aspect_ratio on try_on_history(aspect_ratio) where aspect_ratio is not null;
