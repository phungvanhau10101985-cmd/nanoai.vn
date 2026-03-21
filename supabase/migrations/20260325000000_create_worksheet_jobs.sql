-- Bảng job worksheet – chạy ngầm khi user đóng trình duyệt
create table if not exists worksheet_jobs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null check (type in ('parse_sgk', 'step_by_step_quiz', 'step_by_step_essay')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  params jsonb not null default '{}',
  result jsonb,
  error_message text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  processing_started_at timestamp with time zone
);

create index idx_worksheet_jobs_status on worksheet_jobs(status) where status = 'pending';
create index idx_worksheet_jobs_user_id on worksheet_jobs(user_id);
create index idx_worksheet_jobs_created_at on worksheet_jobs(created_at);

alter table worksheet_jobs enable row level security;

create policy "Users can view own worksheet_jobs"
  on worksheet_jobs for select
  using (auth.uid() = user_id);

create policy "Users can insert own worksheet_jobs"
  on worksheet_jobs for insert
  with check (auth.uid() = user_id);
