-- Trung tâm thông báo – lưu thông báo cho user (vd: admin đã xử lý báo cáo câu hỏi sai)
create table if not exists notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null default 'info',
  title text not null,
  body text default '',
  read_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  -- metadata cho link (vd curriculum_id khi cần điều hướng)
  meta jsonb default '{}'
);

create index if not exists idx_notifications_user_id on notifications(user_id);
create index if not exists idx_notifications_created_at on notifications(created_at desc);
create index if not exists idx_notifications_read_at on notifications(user_id, read_at) where read_at is null;

alter table notifications enable row level security;

drop policy if exists "Users can view own notifications" on notifications;
create policy "Users can view own notifications"
  on notifications for select
  using (auth.uid() = user_id);

drop policy if exists "Users can update own notifications" on notifications;
create policy "Users can update own notifications"
  on notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table notifications is 'Thông báo cho user – admin xử lý báo cáo, v.v.';
