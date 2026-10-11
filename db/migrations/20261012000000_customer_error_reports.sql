-- Lỗi khách gặp khi thao tác (toast lỗi, error boundary, API server). Admin xem ở /admin/error-reports.
-- Cùng fingerprint + cùng khách trong 10 phút thì cộng occurrences, không tạo dòng mới.

create table if not exists public.customer_error_reports (
  id bigserial primary key,
  fingerprint text not null,
  source text not null,
  path text,
  title text,
  message text not null,
  detail text,
  digest text,
  user_id uuid,
  user_email text,
  ip text,
  user_agent text,
  meta jsonb not null default '{}'::jsonb,
  occurrences integer not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  emailed_at timestamptz,
  resolved_at timestamptz,
  resolved_by uuid,
  constraint customer_error_reports_source_chk
    check (source in ('toast', 'boundary', 'server'))
);

create index if not exists customer_error_reports_last_seen_idx
  on public.customer_error_reports (last_seen_at desc);

create index if not exists customer_error_reports_fingerprint_idx
  on public.customer_error_reports (fingerprint, last_seen_at desc);

create index if not exists customer_error_reports_open_idx
  on public.customer_error_reports (last_seen_at desc)
  where resolved_at is null;

create index if not exists customer_error_reports_emailed_idx
  on public.customer_error_reports (emailed_at desc)
  where emailed_at is not null;

comment on table public.customer_error_reports is
  'Lỗi khách gặp khi thao tác. Gửi mail admin có giới hạn tần suất. Xem ở /admin/error-reports.';
