#!/usr/bin/env node
/**
 * Áp các file SQL trong db/migrations/ theo thứ tự tên (Postgres + `pg`).
 * Theo dõi bảng public.app_applied_sql_migrations (tự tạo nếu chưa có).
 *
 * Yêu cầu: DATABASE_URL trong .env.local hoặc môi trường.
 *
 *   node scripts/pg-apply-migrations.mjs           # dry-run (liệt kê pending)
 *   node scripts/pg-apply-migrations.mjs --apply   # chạy thật
 *
 * DB đã có schema sẵn (chưa có bảng tracking này): đánh dấu đã áp hết file
 * (không chạy lại SQL), sau đó chỉ dùng --apply cho migration mới:
 *   node scripts/pg-apply-migrations.mjs --mark-all-applied
 */
import { readdirSync, readFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { Pool } from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const migrationsDir = join(root, 'db', 'migrations')
const envPath = join(root, '.env.local')

function loadEnvLocal() {
  if (!existsSync(envPath)) return
  const lines = readFileSync(envPath, 'utf8').split('\n')
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
  loadEnvLocal()
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
      await pool.end()
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
      await pool.end()
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
