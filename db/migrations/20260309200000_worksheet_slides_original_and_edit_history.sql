-- Bản gốc slide AI tạo lần đầu – không bị ghi đè khi giáo viên sửa bản chung
create table if not exists worksheet_slides_original (
  id uuid default gen_random_uuid() primary key,
  curriculum_id uuid not null references worksheet_curricula(id) on delete cascade,
  content_json jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(curriculum_id)
);

create index idx_worksheet_slides_original_curriculum on worksheet_slides_original(curriculum_id);

alter table worksheet_slides_original enable row level security;

create policy "Authenticated users can view original slides"
  on worksheet_slides_original for select
  using (auth.uid() is not null);

create policy "Authenticated users can insert original slides"
  on worksheet_slides_original for insert
  with check (auth.uid() is not null);

comment on table worksheet_slides_original is 'Bản gốc slide AI tạo lần đầu – không ghi đè khi sửa bản chung';

-- Lịch sử chỉnh sửa bản chung – ai sửa, sửa gì, khi nào
create table if not exists worksheet_slide_edit_history (
  id uuid default gen_random_uuid() primary key,
  curriculum_id uuid not null references worksheet_curricula(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  slides_json jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index idx_slide_edit_history_curriculum on worksheet_slide_edit_history(curriculum_id);
create index idx_slide_edit_history_created on worksheet_slide_edit_history(created_at desc);

alter table worksheet_slide_edit_history enable row level security;

create policy "Authenticated users can view slide edit history"
  on worksheet_slide_edit_history for select
  using (auth.uid() is not null);

create policy "Authenticated users can insert slide edit history"
  on worksheet_slide_edit_history for insert
  with check (auth.uid() is not null);

comment on table worksheet_slide_edit_history is 'Lịch sử chỉnh sửa bản chung – ai sửa, sửa gì, khi nào';
