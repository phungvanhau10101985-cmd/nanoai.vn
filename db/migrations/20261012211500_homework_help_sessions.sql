-- Nhiều hội thoại làm bài của một học sinh. Hội thoại đang mở là bản updated_at mới nhất.
-- Pool server đọc và ghi. Không policy cho anon/authenticated.

create table if not exists public.homework_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  locale text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint homework_sessions_locale_chk
    check (locale in ('vi', 'en', 'zh', 'ja', 'ko'))
);

create index if not exists homework_sessions_user_updated_idx
  on public.homework_sessions (user_id, updated_at desc);

comment on table public.homework_sessions is
  'Các hội thoại làm bài của một học sinh. Hội thoại đang mở là bản updated_at mới nhất.';

create table if not exists public.homework_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.homework_sessions (id) on delete cascade,
  user_id uuid not null,
  role text not null,
  body text not null,
  kind text not null default 'question',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint homework_messages_role_chk check (role in ('user', 'teacher')),
  constraint homework_messages_kind_chk check (kind in ('question', 'photo', 'problem', 'note'))
);

create index if not exists homework_messages_session_idx
  on public.homework_messages (session_id, created_at);

comment on table public.homework_messages is
  'Từng lượt trong hội thoại làm bài. Ảnh gốc không lưu; payload chỉ giữ số ảnh và đề đã đọc.';

alter table public.homework_sessions enable row level security;
alter table public.homework_messages enable row level security;
