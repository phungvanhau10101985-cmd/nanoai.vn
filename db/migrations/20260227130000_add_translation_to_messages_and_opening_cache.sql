-- Thêm cột translation cho câu mở đầu / ý 3 (dịch + phiên âm)
alter table public.language_coach_messages
  add column if not exists translation text;

-- client_message_id để map message client -> db khi chưa load history
alter table public.language_coach_messages
  add column if not exists client_message_id text;

create index if not exists idx_language_coach_messages_session_client
  on public.language_coach_messages(session_id, client_message_id)
  where client_message_id is not null;

-- Cache dịch câu mở đầu (câu lặp lại liên tục)
create table if not exists public.language_coach_opening_translation_cache (
  cache_key text primary key,
  translation text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_opening_translation_cache_created
  on public.language_coach_opening_translation_cache(created_at desc);

alter table public.language_coach_opening_translation_cache enable row level security;

-- Không tạo policy: chỉ service role (API) truy cập cache, bypass RLS

-- Policy update cho messages (user chỉ update message của mình)
drop policy if exists "language_coach_messages_update_own" on public.language_coach_messages;
create policy "language_coach_messages_update_own"
  on public.language_coach_messages
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
