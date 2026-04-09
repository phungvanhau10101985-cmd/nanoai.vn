-- Blob (ảnh/audio) chỉ còn trên Bunny; RPC cleanup không xóa storage.objects nữa.
-- Xóa file quá hạn: app (cron) gọi Bunny Storage API; DB chỉ xóa metadata meeting_recordings.

create or replace function public.cleanup_meeting_recordings_older_than(p_days integer)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  n bigint;
  d interval;
begin
  if p_days is null or p_days < 1 then
    raise exception 'p_days must be >= 1';
  end if;
  d := make_interval(days => p_days);
  with del_r as (
    delete from public.meeting_recordings m
    where m.created_at < (now() - d)
    returning 1
  )
  select count(*)::bigint into n from del_r;
  return coalesce(n, 0);
end;
$$;

comment on function public.cleanup_meeting_recordings_older_than(integer) is
  'Deletes meeting_recordings rows older than p_days; audio files removed by app cron via Bunny before this runs.';

create or replace function public.cleanup_exam_essay_images_older_than(p_days integer)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_days is null or p_days < 1 then
    raise exception 'p_days must be >= 1';
  end if;
  return 0;
end;
$$;

comment on function public.cleanup_exam_essay_images_older_than(integer) is
  'No-op for legacy object storage; exam essay images are purged on Bunny via cleanupBunnyExamEssayImagesOlderThan.';
