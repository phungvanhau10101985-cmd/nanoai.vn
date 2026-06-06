-- Theo dõi lần đầu gọi AI giáo trình (không reset khi xóa curriculum row).
create table if not exists public.curriculum_ai_first_use (
  user_id uuid not null references auth.users(id) on delete cascade,
  artifact_key text not null,
  artifact_kind text not null,
  usage_date date not null,
  year_month text not null,
  waived boolean not null default true,
  credits_charged numeric(10,2),
  metadata_json text,
  created_at timestamptz not null default now(),
  primary key (user_id, artifact_key)
);

create index if not exists idx_curriculum_ai_first_use_user_usage_date
  on public.curriculum_ai_first_use(user_id, usage_date, artifact_kind, waived);

create index if not exists idx_curriculum_ai_first_use_user_year_month
  on public.curriculum_ai_first_use(user_id, year_month, artifact_kind, waived);
