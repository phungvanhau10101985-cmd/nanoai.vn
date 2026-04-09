/**
 * Kiểm tra DATABASE_URL (Postgres local / cloud): SELECT 1
 *
 * Chạy:
 *   npx tsx scripts/pg-smoke-local.ts
 *   npm run pg:smoke
 * PowerShell chặn npm.ps1: dùng `npm.cmd run pg:smoke` hoặc `npx.cmd tsx scripts/pg-smoke-local.ts`
 *
 * Thứ tự URL: .env.local → .env → nếu vẫn trống thì dòng đầu trong
 * `.cache/DATABASE_URL_FRESH.txt` (do `pg:fresh-restore-public` ghi).
 */
import { existsSync, readFileSync } from 'fs'
import { config } from 'dotenv'
import { resolve } from 'path'
import { checkPgConnection } from '../src/lib/db/pg-query'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

const freshPath = resolve(process.cwd(), '.cache', 'DATABASE_URL_FRESH.txt')
if (!process.env.DATABASE_URL?.trim() && existsSync(freshPath)) {
  const line = readFileSync(freshPath, 'utf8').trim().split(/\r?\n/)[0]?.trim()
  if (line) {
    process.env.DATABASE_URL = line
    console.log('[pg:smoke] Dùng DATABASE_URL từ .cache/DATABASE_URL_FRESH.txt')
  }
}

checkPgConnection()
  .then((r) => {
    console.log(JSON.stringify(r, null, 2))
    process.exit(r.ok ? 0 : 1)
  })
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
