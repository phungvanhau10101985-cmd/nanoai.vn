/**
 * Tạo role + schema auth + auth.uid()/auth.role() tối thiểu cho Postgres tự host
 * — để pg_restore policy "TO authenticated" không lỗi (schema/policy kiểu JWT claims).
 * Thêm: bảng auth.instances (nếu chưa có) + seed 1 dòng nếu đang trống
 * (fix lỗi đăng nhập email: auth.instances_empty).
 *
 *   npm run pg:ensure-auth-compat
 *   node scripts/pg-ensure-auth-compat.mjs
 */
import pg from 'pg'
import { resolve } from 'node:path'
import { config } from 'dotenv'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

const url = process.env.DATABASE_URL?.trim()
if (!url) {
  console.error('Thiếu DATABASE_URL.')
  process.exit(1)
}

const sql = `
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
END
$do$;

CREATE SCHEMA IF NOT EXISTS auth;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid,
    (
      COALESCE(
        NULLIF(current_setting('request.jwt.claims', true), ''),
        '{}'
      )::jsonb->>'sub'
    )::uuid
  );
$$;

CREATE OR REPLACE FUNCTION auth.role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claim.role', true), ''),
    (COALESCE(
      NULLIF(current_setting('request.jwt.claims', true), ''),
      '{}'
    )::jsonb->>'role')::text
  );
$$;

GRANT USAGE ON SCHEMA auth TO postgres, anon, authenticated, service_role;

-- Ít nhất một auth.instances (đăng nhập OTP: public.nanoai_ensure_user_by_email).
create table if not exists auth.instances (
  id uuid primary key default gen_random_uuid()
);

insert into auth.instances (id)
select gen_random_uuid()
where not exists (select 1 from auth.instances limit 1);
`

const client = new pg.Client({ connectionString: url })
await client.connect()
try {
  await client.query(sql)
  console.log(
    'OK: roles anon/authenticated/service_role + auth.uid()/auth.role() + auth.instances (ít nhất 1 dòng khi có thể)'
  )
} finally {
  await client.end()
}
