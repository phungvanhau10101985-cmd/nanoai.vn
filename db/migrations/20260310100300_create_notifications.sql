-- Trung tâm thông báo – lưu thông báo cho user (vd: admin đã xử lý báo cáo câu hỏi sai)
create table if not exists public.notifications (
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

-- Bảng có thể đã tạo tay / phiên bản cũ không có read_at → IF NOT EXISTS bỏ qua CREATE và index fail.
alter table public.notifications add column if not exists read_at timestamptz;

create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_notifications_created_at on public.notifications(created_at desc);
create index if not exists idx_notifications_read_at on public.notifications(user_id, read_at) where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists "Users can view own notifications" on public.notifications;
create policy "Users can view own notifications"
  on public.notifications for select
  using ((auth.uid())::text = (user_id)::text);

drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications"
  on public.notifications for update
  using ((auth.uid())::text = (user_id)::text)
  with check ((auth.uid())::text = (user_id)::text);

comment on table public.notifications is 'Thông báo cho user – admin xử lý báo cáo, v.v.';
