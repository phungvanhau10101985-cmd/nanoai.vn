-- Bảng job dịch ảnh – xử lý nền, không phụ thuộc client
create table if not exists translate_jobs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  history_id uuid references try_on_history(id) on delete cascade not null,
  source_lang text not null default 'en',
  target_lang text not null default 'vi',
  image_quality text not null default '2K' check (image_quality in ('2K', '4K')),
  cost numeric(5,2) not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  error_message text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index idx_translate_jobs_status on translate_jobs(status);
create index idx_translate_jobs_user_id on translate_jobs(user_id);
create index idx_translate_jobs_created_at on translate_jobs(created_at);

alter table translate_jobs enable row level security;

-- User chỉ xem job của mình
create policy "Users can view own translate_jobs"
  on translate_jobs for select
  using (auth.uid() = user_id);

-- User có thể tạo job của mình
create policy "Users can insert own translate_jobs"
  on translate_jobs for insert
  with check (auth.uid() = user_id);
