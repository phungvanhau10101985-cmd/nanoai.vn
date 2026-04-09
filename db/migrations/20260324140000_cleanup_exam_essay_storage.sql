-- Xóa object storage ảnh bài tự luận quá hạn (bucket exam-essay-images).
-- Gọi qua RPC từ cron (service_role); không expose cho anon/authenticated.

create or replace function public.cleanup_exam_essay_images_older_than(p_days integer)
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
  with deleted as (
    delete from storage.objects o
    where o.bucket_id = 'exam-essay-images'
      and o.created_at < (now() - d)
    returning 1
  )
  select count(*)::bigint into n from deleted;
  return coalesce(n, 0);
end;
$$;

comment on function public.cleanup_exam_essay_images_older_than(integer) is
  'Deletes storage.objects in exam-essay-images older than p_days; for scheduled cleanup only.';

revoke all on function public.cleanup_exam_essay_images_older_than(integer) from public;
grant execute on function public.cleanup_exam_essay_images_older_than(integer) to service_role;
