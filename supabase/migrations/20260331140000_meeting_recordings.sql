-- Bản ghi cuộc họp (audio) — lưu qua API service role; xóa sau N ngày bằng cron RPC.

create table if not exists public.meeting_recordings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '',
  storage_path text not null,
  duration_seconds integer not null,
  mime_type text not null,
  file_size_bytes bigint not null,
  created_at timestamptz not null default now()
);

create index if not exists meeting_recordings_user_created_idx
  on public.meeting_recordings (user_id, created_at desc);

comment on table public.meeting_recordings is
  'Metadata bản ghi cuộc họp; file trong bucket meeting-recordings; retention theo cleanup_meeting_recordings_older_than.';

alter table public.meeting_recordings enable row level security;

drop policy if exists "Users select own meeting_recordings" on public.meeting_recordings;
create policy "Users select own meeting_recordings"
  on public.meeting_recordings for select
  to authenticated
  using (auth.uid() = user_id);

-- Bucket private — chỉ service role ghi/đọc qua API
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'meeting-recordings',
  'meeting-recordings',
  false,
  20971520,
  array['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/mpeg', 'audio/x-m4a']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Xóa object storage + dòng DB quá hạn (gọi từ cron, service_role)
create or replace function public.cleanup_meeting_recordings_older_than(p_days integer)
returns bigint
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  n bigint;
  d interval;
begin
  if p_days is null or p_days < 1 then
    raise exception 'p_days must be >= 1';
  end if;
  d := make_interval(days => p_days);
  with old as (
    select id, storage_path
    from public.meeting_recordings
    where created_at < (now() - d)
  ),
  del_o as (
    delete from storage.objects o
    using old
    where o.bucket_id = 'meeting-recordings'
      and o.name = old.storage_path
    returning 1
  ),
  del_r as (
    delete from public.meeting_recordings m
    using old
    where m.id = old.id
    returning 1
  )
  select count(*)::bigint into n from del_r;
  return coalesce(n, 0);
end;
$$;

comment on function public.cleanup_meeting_recordings_older_than(integer) is
  'Deletes meeting_recordings rows and matching storage.objects older than p_days; for scheduled cleanup only.';

revoke all on function public.cleanup_meeting_recordings_older_than(integer) from public;
grant execute on function public.cleanup_meeting_recordings_older_than(integer) to service_role;
