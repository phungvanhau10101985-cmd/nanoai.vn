-- Postgres thủ công: bổ sung auth.role() cho RLS kiểu Supabase (vd. auth.role() = 'authenticated').
-- Chạy TRƯỚC 20260223110000_create_language_coach_vocab_cache.sql theo thứ tự tên file.
-- Idempotent: nếu auth.role() đã có (Supabase cloud) thì bỏ qua.
-- VPS đã chạy qua 20231201000000 mà vẫn thiếu role: kéo pull + chạy lại migrate — file này sẽ pending trước 231100.

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'auth'
      and p.proname = 'role'
      and p.pronargs = 0
  ) then
    create function auth.role()
      returns text
      language sql
      stable
    as $fn$
      select coalesce(
        nullif(trim(both from current_setting('request.jwt.claim.role', true)), ''),
        nullif(trim(both from current_setting('app.current_role', true)), ''),
        case
          when auth.uid() is not null then 'authenticated'
          else 'anon'
        end
      );
    $fn$;
    comment on function auth.role () is
      'Self-hosted: JWT role hoặc app.current_role; fallback authenticated nếu auth.uid() không null.';
  end if;
end $$;
