-- Postgres Docker / RDS thường KHÔNG có schema auth.* và không có auth.uid().
-- Chuỗi migration repo xây kiểu Supabase (profiles → auth.users, RLS auth.uid(), trigger trên auth.users).
-- Migration này idempotent:
-- - Nếu auth.users đã tồn tại (Supabase cloud / đã bootstrap tay) → không tạo bảng, không đè auth.uid().
-- - Nếu thiếu → tạo schema auth, bảng users tối thiểu + auth.uid() / auth.role() đọc GUC JWT hoặc app.*.

create schema if not exists auth;

do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'auth'
      and table_name = 'users'
  ) then
    create table auth.users (
      id uuid primary key,
      raw_user_meta_data jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    comment on table auth.users is
      'Self-hosted compat: stub tối thiểu. App nên đồng bộ user id với JWT / đăng ký; không dùng nếu Supabase có auth.users.';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'auth'
      and p.proname = 'uid'
      and p.pronargs = 0
  ) then
    create function auth.uid()
      returns uuid
      language sql
      stable
    as $fn$
      select coalesce(
        nullif(trim(both from current_setting('request.jwt.claim.sub', true)), '')::uuid,
        nullif(trim(both from current_setting('app.current_user_id', true)), '')::uuid
      );
    $fn$;
    comment on function auth.uid () is
      'Self-hosted: JWT sub (khớp kiểu Supabase) hoặc app.current_user_id; không ghi đè nếu auth.uid đã có sẵn.';
  end if;
end $$;

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
      'Self-hosted: JWT role (authenticated/anon/service_role) hoặc app.current_role; fallback theo auth.uid().';
  end if;
end $$;
