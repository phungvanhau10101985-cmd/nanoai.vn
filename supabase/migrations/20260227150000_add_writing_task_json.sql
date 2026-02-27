-- Lưu trạng thái bài viết mini để mở trên thiết bị khác vẫn có đầy đủ
alter table public.language_coach_messages
  add column if not exists writing_task_json text;
