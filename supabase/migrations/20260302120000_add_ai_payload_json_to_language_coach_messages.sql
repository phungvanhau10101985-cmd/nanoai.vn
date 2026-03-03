-- Lưu raw payload AI theo từng turn để replay đầy đủ dữ liệu gốc.
alter table public.language_coach_messages
  add column if not exists ai_payload_json text;
