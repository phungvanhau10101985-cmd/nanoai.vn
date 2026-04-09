/**
 * Kiểm tra DATABASE_URL + schema credits bắt buộc cho app (chỉ Postgres, không qua HTTP API cũ).
 *
 * Chạy:
 *   npm run pg:check-credits
 *   npx tsx scripts/pg-check-credits.ts
 *
 * Thứ tự URL: .env.local → .env → `.cache/DATABASE_URL_FRESH.txt` (giống pg:smoke).
 */
import { existsSync, readFileSync } from 'fs'
import { config } from 'dotenv'
import { resolve } from 'path'
import pg from 'pg'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

const freshPath = resolve(process.cwd(), '.cache', 'DATABASE_URL_FRESH.txt')
if (!process.env.DATABASE_URL?.trim() && existsSync(freshPath)) {
  const line = readFileSync(freshPath, 'utf8').trim().split(/\r?\n/)[0]?.trim()
  if (line) {
    process.env.DATABASE_URL = line
    console.log('[pg:check-credits] Dùng DATABASE_URL từ .cache/DATABASE_URL_FRESH.txt')
  }
}

async function main() {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) {
    console.error('Thiếu DATABASE_URL. Thêm vào .env.local (hoặc .env), hoặc chạy pg:fresh-restore-public để tạo .cache/DATABASE_URL_FRESH.txt')
    process.exit(1)
  }

  const pool = new pg.Pool({ connectionString: url, max: 2 })
  try {
    await pool.query('select 1')

    const table = await pool.query<{ exists: boolean }>(
      `select exists(
        select 1 from information_schema.tables
        where table_schema = 'public' and table_name = 'credits'
      ) as exists`
    )
    const hasTable = Boolean(table.rows[0]?.exists)

    const fn = await pool.query<{ exists: boolean }>(
      `select exists(
        select 1 from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'spend_credits_idempotent'
      ) as exists`
    )
    const hasFn = Boolean(fn.rows[0]?.exists)

    const out = {
      ok: hasTable && hasFn,
      databaseUrlSet: true,
      publicCreditsTable: hasTable,
      spendCreditsIdempotent: hasFn,
    }
    console.log(JSON.stringify(out, null, 2))

    if (!hasTable) {
      console.error(
        'Thiếu bảng public.credits. Áp dụng migration (vd. npm run db:push hoặc restore dump có init + migrations).'
      )
    }
    if (!hasFn) {
      console.error(
        'Thiếu function public.spend_credits_idempotent. Cần file migration 20260303103000_add_atomic_english_coach_credit_charging.sql trong supabase/migrations/ (hoặc tương đương).'
      )
    }

    process.exit(out.ok ? 0 : 1)
  } finally {
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
