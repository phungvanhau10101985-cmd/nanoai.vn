-- Chat 1:1 học sinh với gia sư AI.
-- Chủ đề và nhãn dùng chung chỉ ghi sau khi kiểm tra chéo. Pool server (chủ bảng) đọc và ghi.
-- Không policy cho anon/authenticated: học sinh không đọc bảng này qua API dữ liệu.

create table if not exists public.tutor_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  locale text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tutor_sessions_user_unique unique (user_id),
  constraint tutor_sessions_locale_chk
    check (locale in ('vi', 'en', 'zh', 'ja', 'ko'))
);

comment on table public.tutor_sessions is
  'Một phiên chat 1:1 giữa một học sinh và gia sư AI.';

create table if not exists public.tutor_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.tutor_sessions (id) on delete cascade,
  user_id uuid not null,
  role text not null,
  body text not null,
  topic_key text not null default '',
  kind text not null default 'question',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint tutor_messages_role_chk check (role in ('user', 'tutor')),
  constraint tutor_messages_kind_chk check (kind in ('question', 'label', 'answer'))
);

create index if not exists tutor_messages_session_idx
  on public.tutor_messages (session_id, created_at);

comment on table public.tutor_messages is
  'Từng câu trong phiên 1:1. topic_key là chủ đề đã phân loại của câu học sinh.';

create table if not exists public.tutor_topics (
  topic_key text not null,
  locale text not null,
  title text not null,
  explanation text not null,
  practice text not null,
  labels jsonb not null,
  draft_model text not null,
  check_model text not null,
  usage_count integer not null default 1,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (topic_key, locale),
  constraint tutor_topics_locale_chk
    check (locale in ('vi', 'en', 'zh', 'ja', 'ko'))
);

create index if not exists tutor_topics_locale_usage_idx
  on public.tutor_topics (locale, usage_count desc, last_used_at desc);

comment on table public.tutor_topics is
  'Chủ đề đã kiểm tra chéo. Học sinh khác hỏi cùng chủ đề hoặc bấm cùng nhãn thì đọc bản này. labels là 2 đến 3 nhãn đào sâu.';

alter table public.tutor_sessions enable row level security;
alter table public.tutor_messages enable row level security;
alter table public.tutor_topics enable row level security;
