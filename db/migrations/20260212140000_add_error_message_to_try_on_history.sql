-- Thêm cột error_message để hiển thị lỗi khi dịch thất bại
alter table try_on_history add column if not exists error_message text;
