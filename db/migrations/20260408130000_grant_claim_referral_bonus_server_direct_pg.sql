-- Grant cho role postgres khi hàm đã tồn tại (hàm được tạo ở 20260412120000 — thứ tự tên file 20260408 < 20260412).
-- Tránh lỗi khi GRANT chạy trước CREATE FUNCTION.
do $do$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'claim_referral_bonus_server'
      and pg_get_function_identity_arguments(p.oid) = 'uuid, uuid'
  ) then
    execute 'grant execute on function public.claim_referral_bonus_server(uuid, uuid) to postgres';
  end if;
end
$do$;
