-- Lịch sử bản riêng – lưu trước khi reset về bản gốc. Có thể khôi phục trong 5 ngày.
create table if not exists user_customized_slides_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  curriculum_id uuid not null references worksheet_curricula(id) on delete cascade,
  slides_json jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_user_customized_slides_history_user_curriculum on user_customized_slides_history(user_id, curriculum_id);
create index if not exists idx_user_customized_slides_history_created on user_customized_slides_history(created_at desc);

alter table user_customized_slides_history enable row level security;

drop policy if exists "Users can view own history" on user_customized_slides_history;
create policy "Users can view own history"
  on user_customized_slides_history for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own history" on user_customized_slides_history;
create policy "Users can insert own history"
  on user_customized_slides_history for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own history" on user_customized_slides_history;
create policy "Users can delete own history"
  on user_customized_slides_history for delete
  using (auth.uid() = user_id);

comment on table user_customized_slides_history is 'Lịch sử bản riêng – lưu trước khi reset về bản gốc. Khôi phục trong 5 ngày. Sau 5 ngày xóa.';
