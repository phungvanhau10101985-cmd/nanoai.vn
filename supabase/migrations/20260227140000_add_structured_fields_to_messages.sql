-- Lưu đầy đủ dữ liệu buổi học để mở lại trên thiết bị khác không cần tách từ lại
alter table public.language_coach_messages
  add column if not exists main_sentence text;

alter table public.language_coach_messages
  add column if not exists correction_note text;

alter table public.language_coach_messages
  add column if not exists intent_answer text;

alter table public.language_coach_messages
  add column if not exists tokens_json text;
