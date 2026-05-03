#!/usr/bin/env node
/**
 * Áp các file SQL trong db/migrations/ theo thứ tự tên (Postgres + `pg`).
 * Theo dõi bảng public.app_applied_sql_migrations (tự tạo nếu chưa có).
 *
 * Yêu cầu: DATABASE_URL — biến môi trường, hoặc .env.local, hoặc .env (VPS thường dùng .env).
 *
 *   node scripts/pg-apply-migrations.mjs            # dry-run (liệt kê pending)
 *   node scripts/pg-apply-migrations.mjs --apply  # chạy thật
 *
 * --- DB production đã từng tạo schema tay / restore, KHÔNG có lịch sử migration: ---
 * Nếu chạy --apply từ đầu sẽ lỗi kiểu "relation already exists" ở init.
 *
 * 1) Sửa lệch schema còn thiếu (ví dụ cột: chạy file tương ứng bằng psql, file thường dùng IF NOT EXISTS):
 *    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/20260408150000_profiles_english_coach_learner.sql
 *
 * 2) Ghi nhận toàn bộ file trong repo là đã áp (KHÔNG thực thi lại SQL):
 *    node scripts/pg-apply-migrations.mjs --mark-all-applied
 *
 * 3) Kiểm tra: node scripts/pg-apply-migrations.mjs  →  Chờ: 0
 * Từ đó về sau chỉ cần db:migrate:push khi pull thêm file migration mới.
 *
 * Lưu ý VPS / CI: chỉ chạy "file migration mới" lẻ một file (checksum) trong khi DATABASE_URL là DB
 * chưa từng chạy stack messaging → sẽ lỗi thiếu public.messaging_partners. Luôn áp các file pending
 * theo đúng thứ tự tên (*.sql đã sort), hoặc dùng npm run db:migrate:push trước khi deploy chỉ một file.
 *
 * Postgres thuần (Docker) không có schema auth của Supabase: file 20231201000000_self_hosted_postgres_auth_compat.sql
 * chạy trước init.sql để có auth.users stub + auth.uid(); DB Supabase cloud đã có auth.users và auth.uid thì không ghi đè.
 * Nếu thiếu auth.role(): thêm 20260223109900_self_hosted_auth_role_compat.sql (đã kèm trong repo) hoặc bản mới nhất của file 202312 đã gộp auth.role().
 *
 * Chỉ dùng --mark-all-applied khi bạn chấp nhận rằng DB đã tương đương (hoặc đã sửa drift tay).
 * Sai → các migration tương lai bỏ qua bước thật sự cần.
 */
import { readdirSync, readFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { Pool } from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const migrationsDir = join(root, 'db', 'migrations')

function loadEnvFile(name) {
  const p = join(root, name)
  if (!existsSync(p)) return
  const lines = readFileSync(p, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const k = trimmed.slice(0, eq).trim()
    let v = trimmed.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!process.env[k]) process.env[k] = v
  }
}

const BOOTSTRAP = `
create table if not exists public.app_applied_sql_migrations (
  migration_filename text primary key,
  applied_at timestamptz not null default now()
);
comment on table public.app_applied_sql_migrations is 'Theo dõi file đã chạy từ db/migrations/.';
`

async function main() {
  loadEnvFile('.env.local')
  loadEnvFile('.env')
  const dsn = process.env.DATABASE_URL?.trim()
  if (!dsn) {
    console.error('Thiếu DATABASE_URL')
    process.exit(1)
  }

  const apply = process.argv.includes('--apply')
  const markAll = process.argv.includes('--mark-all-applied')
  if (!existsSync(migrationsDir)) {
    console.error('Không thấy thư mục db/migrations')
    process.exit(1)
  }

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  const pool = new Pool({ connectionString: dsn, max: 1 })
  try {
    await pool.query(BOOTSTRAP)

    if (markAll) {
      for (const f of files) {
        await pool.query(
          `insert into public.app_applied_sql_migrations (migration_filename) values ($1)
           on conflict (migration_filename) do nothing`,
          [f]
        )
      }
      console.log(`Đã đánh dấu ${files.length} file (mark-all-applied). Kiểm tra lại DB trước khi tin tưởng hoàn toàn.`)
      return
    }

    const applied = await pool.query(
      `select migration_filename from public.app_applied_sql_migrations`
    )
    const done = new Set(applied.rows.map((r) => r.migration_filename))
    const pending = files.filter((f) => !done.has(f))

    console.log(`Tổng file .sql: ${files.length} | Đã áp: ${done.size} | Chờ: ${pending.length}`)
    for (const f of pending) {
      console.log(`  [pending] ${f}`)
    }

    if (!apply) {
      if (pending.length) console.log('\nThêm --apply để chạy các file pending.')
      return
    }

    for (const f of pending) {
      const full = join(migrationsDir, f)
      const sql = readFileSync(full, 'utf8')
      console.log(`\nApplying ${f} ...`)
      try {
        await pool.query(sql)
        await pool.query(
          `insert into public.app_applied_sql_migrations (migration_filename) values ($1)`,
          [f]
        )
        console.log(`OK: ${f}`)
      } catch (e) {
        throw new Error(`Lỗi khi chạy ${f}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    console.log('\nHoàn tất migration (PG-only).')
  } finally {
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
