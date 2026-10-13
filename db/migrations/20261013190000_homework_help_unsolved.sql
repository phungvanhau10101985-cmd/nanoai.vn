-- Bài hỗ trợ làm bài không hiện đáp án vì Gemini Pro không khớp DeepSeek nào.
-- Admin xem ở /admin/homework-unsolved. Mail gom một lần mỗi ngày nếu còn bài chưa gửi.

create table if not exists public.homework_help_unsolved (
  id bigserial primary key,
  fingerprint text not null,
  locale text not null,
  statement text not null,
  draft_answer text not null default '',
  check_answer text not null default '',
  gemini_answer text not null default '',
  gpt_answer text not null default '',
  user_id uuid,
  occurrences integer not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  emailed_at timestamptz,
  resolved_at timestamptz,
  resolved_by uuid
);

create unique index if not exists homework_help_unsolved_open_fp_idx
  on public.homework_help_unsolved (fingerprint)
  where resolved_at is null;

create index if not exists homework_help_unsolved_last_seen_idx
  on public.homework_help_unsolved (last_seen_at desc);

create index if not exists homework_help_unsolved_unmailed_idx
  on public.homework_help_unsolved (first_seen_at)
  where emailed_at is null and resolved_at is null;

comment on table public.homework_help_unsolved is
  'Bài chưa hiện đáp án. Mail admin một lần mỗi ngày khi có bài chưa gửi. Xem ở /admin/homework-unsolved.';
