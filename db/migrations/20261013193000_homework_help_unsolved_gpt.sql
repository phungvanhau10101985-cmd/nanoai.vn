-- Thêm đáp án GPT cho bài chưa có kết quả. Bảng tạo mới đã có cột này.

alter table public.homework_help_unsolved
  add column if not exists gpt_answer text not null default '';
