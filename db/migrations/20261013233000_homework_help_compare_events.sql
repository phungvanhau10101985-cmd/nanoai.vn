-- Mỗi lần hỗ trợ làm bài đối chiếu đáp án hoặc chấm một dòng kiến thức.
-- Trang /admin/homework-compare-stats đọc bảng này để vẽ tỷ lệ khớp.

create table if not exists public.homework_help_compare_events (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  locale text not null,
  checkpoint text not null,
  outcome text not null,
  fingerprint text not null default '',
  user_id uuid
);

create index if not exists homework_help_compare_events_created_idx
  on public.homework_help_compare_events (created_at desc);

create index if not exists homework_help_compare_events_checkpoint_idx
  on public.homework_help_compare_events (checkpoint, outcome, created_at desc);

comment on table public.homework_help_compare_events is
  'Kết quả đối chiếu bài: DeepSeek với Gemini Pro, GPT khi lệch, và từng dòng kiến thức. Xem ở /admin/homework-compare-stats.';
