-- Dự án xây nhà từ đất trống - lưu từng bước
create table if not exists house_build_projects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text default 'Dự án mới',
  -- Thông tin nhà (bước 1)
  house_info jsonb default '{}',
  -- Các bước: floor_3d, floor_plan_1, structural_1, floor_plan_2, structural_2, ...
  steps jsonb default '{}',
  -- Bước hiện tại: floor_3d | floor_plan_1 | structural_1 | floor_plan_2 | ...
  current_step text default 'floor_3d',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table house_build_projects enable row level security;

create policy "Users can view own house_build_projects"
  on house_build_projects for select using (auth.uid() = user_id);

create policy "Users can insert own house_build_projects"
  on house_build_projects for insert with check (auth.uid() = user_id);

create policy "Users can update own house_build_projects"
  on house_build_projects for update using (auth.uid() = user_id);

create policy "Users can delete own house_build_projects"
  on house_build_projects for delete using (auth.uid() = user_id);

create index idx_house_build_projects_user_id on house_build_projects(user_id);
create index idx_house_build_projects_updated_at on house_build_projects(updated_at desc);
