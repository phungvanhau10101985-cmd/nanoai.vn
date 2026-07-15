-- Hub Studio: workflow thiết kế liền mạch trong khung chat

alter table public.hub_chat_threads
  add column if not exists session_json jsonb;

alter table public.hub_chat_messages
  add column if not exists studio_json jsonb;
