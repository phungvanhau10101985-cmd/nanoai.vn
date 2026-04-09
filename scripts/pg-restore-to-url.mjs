/**
 * Restore file dump vào DATABASE_URL (.env.local)
 *   node scripts/pg-restore-to-url.mjs path\\to\\file.dump
 * Trên PostgreSQL < 17: tự xuất SQL, bỏ SET transaction_timeout (dump từ PG17 hosted), rồi psql — hết lỗi trên PG15.
 * Tắt: PG_RESTORE_SQL_PIPELINE=0 (luôn pg_restore trực tiếp).
 * Hoặc: PG_SQL_ON_ERROR_STOP=0 nếu cần psql không dừng ở lỗi.
 */
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { config } from 'dotenv'
import { runPgRestoreOrSqlPipeline, resolvePgRestoreBin } from './pg-restore-common.mjs'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

const args = process.argv.slice(2)
const useClean = args.includes('--clean')
const onlyPublic = args.includes('--only-public')
const dumpArg = args.find(
  (a) => !['--clean', '--only-public'].includes(a) && !a.startsWith('-')
)

const dbUrl = process.env.DATABASE_URL?.trim()
const dump = (dumpArg || process.env.PG_DUMP_FILE || '').trim()

if (!dbUrl) {
  console.error('Thiếu DATABASE_URL.')
  process.exit(1)
}
if (!dump || !existsSync(dump)) {
  console.error('Thiếu file dump hoặc không tồn tại. Truyền đường dẫn hoặc set PG_DUMP_FILE.')
  process.exit(1)
}

const pgRestore = resolvePgRestoreBin()
if (process.platform === 'win32' && !existsSync(pgRestore)) {
  console.error('Không thấy pg_restore — cài PostgreSQL hoặc set PG_RESTORE_PATH / PG_BIN.')
  process.exit(1)
}

const pgRestoreMiddleArgs = ['--verbose', '--no-owner', '--no-acl']
if (useClean) pgRestoreMiddleArgs.push('--clean', '--if-exists')
if (onlyPublic) pgRestoreMiddleArgs.push('-n', 'public')

const mode = [onlyPublic ? '+ -n public' : '', useClean ? '+ --clean' : '']
  .filter(Boolean)
  .join(' ')
console.log('pg_restore', mode || '', '→ DATABASE_URL')

const r = runPgRestoreOrSqlPipeline({
  dbUrl,
  absDump: resolve(process.cwd(), dump),
  pgRestoreMiddleArgs,
})
const code = r.status ?? 1
if (code !== 0 && code !== 1) process.exit(code)
process.exit(0)
