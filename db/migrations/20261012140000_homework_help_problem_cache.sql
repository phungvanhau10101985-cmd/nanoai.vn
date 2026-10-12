-- Cache bài đã kiểm tra chéo. Cùng một đề (vân tay chữ) hoặc cùng một ảnh thì học sinh sau dùng lại nội dung đã lưu.
-- Không policy cho anon/authenticated: pool server (chủ bảng) ghi và đọc. Đáp án không mở qua API dữ liệu.

create table if not exists public.homework_help_problem_cache (
  fingerprint text not null,
  locale text not null,
  statement text not null,
  knowledge jsonb not null,
  thinking jsonb not null,
  hints jsonb not null,
  answer text not null default '',
  read_model text not null,
  check_model text not null,
  usage_count integer not null default 1,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (fingerprint, locale),
  constraint homework_help_problem_cache_locale_chk
    check (locale in ('vi', 'en', 'zh', 'ja', 'ko'))
);

create index if not exists homework_help_problem_cache_last_used_idx
  on public.homework_help_problem_cache (last_used_at desc);

comment on table public.homework_help_problem_cache is
  'Nội dung một câu bài tập đã kiểm tra chéo. Khóa là vân tay đề đã chuẩn hóa và ngôn ngữ.';

create table if not exists public.homework_help_photo_cache (
  image_hash text not null,
  locale text not null,
  guide jsonb not null,
  usage_count integer not null default 1,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (image_hash, locale),
  constraint homework_help_photo_cache_locale_chk
    check (locale in ('vi', 'en', 'zh', 'ja', 'ko'))
);

create index if not exists homework_help_photo_cache_last_used_idx
  on public.homework_help_photo_cache (last_used_at desc);

comment on table public.homework_help_photo_cache is
  'Cả trang bài đã đọc và kiểm tra, theo hash byte ảnh và ngôn ngữ.';

alter table public.homework_help_problem_cache enable row level security;
alter table public.homework_help_photo_cache enable row level security;
