-- Hạn mức tạo câu / tách SGK. Không giảm khi xóa câu.
create table if not exists public.curriculum_worksheet_ai_quota (
  curriculum_id uuid primary key references public.worksheet_curricula(id) on delete cascade,
  quiz_created integer not null default 0,
  essay_created integer not null default 0,
  sgk_extracts integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.curriculum_worksheet_ai_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  quiz_waived integer not null default 0,
  essay_waived integer not null default 0,
  sgk_waived integer not null default 0,
  primary key (user_id, usage_date)
);
