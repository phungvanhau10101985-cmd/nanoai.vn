-- Bảng ghi log sử dụng API Google (Gemini)
create table if not exists api_usage_log (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete set null,
  model text not null,
  feature text not null,
  prompt_token_count integer not null default 0,
  candidates_token_count integer not null default 0,
  total_token_count integer not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index idx_api_usage_log_user_id on api_usage_log(user_id);
create index idx_api_usage_log_model on api_usage_log(model);
create index idx_api_usage_log_feature on api_usage_log(feature);
create index idx_api_usage_log_created_at on api_usage_log(created_at);

alter table api_usage_log enable row level security;

-- Chỉ admin mới xem được (role = admin trong profiles)
create policy "Admin can view api_usage_log"
  on api_usage_log for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- User có thể insert log của chính mình (từ server actions)
create policy "Users can insert own api_usage_log"
  on api_usage_log for insert
  with check (user_id is null or user_id = auth.uid());

comment on table api_usage_log is 'Log sử dụng API Google Gemini - token, model, chức năng';
