/**
 * pg_dump → file custom format trong backups/
 *   node scripts/pg-backup-source.mjs
 *
 * URI nguồn (ưu tiên tên trung tính):
 *   PG_DUMP_SOURCE_URL — bất kỳ connection string Postgres (khuyến nghị)
 *   SUPABASE_DB_URL — alias cũ (Session pooler / Direct từ dashboard hosted DB)
 *
 * Cloud Postgres thường 17 — cần pg_dump 17+ (hoặc PG_DUMP_PATH). pg_dump 15 có thể báo "server version mismatch".
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { config } from 'dotenv'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

const uri = process.env.PG_DUMP_SOURCE_URL?.trim() || process.env.SUPABASE_DB_URL?.trim()
if (!uri) {
  console.error('Thiếu PG_DUMP_SOURCE_URL hoặc SUPABASE_DB_URL trong .env / .env.local (connection string Postgres cho pg_dump).')
  process.exit(1)
}

function resolvePgDump() {
  if (process.env.PG_DUMP_PATH && existsSync(process.env.PG_DUMP_PATH)) {
    return process.env.PG_DUMP_PATH
  }
  const pgBin = process.env.PG_BIN?.trim()
  if (pgBin) {
    const p = join(pgBin, process.platform === 'win32' ? 'pg_dump.exe' : 'pg_dump')
    if (existsSync(p)) return p
  }
  if (process.platform !== 'win32') return 'pg_dump'
  const pf = process.env.ProgramFiles || 'C:\\Program Files'
  for (const ver of ['18', '17', '16', '15']) {
    const p = join(pf, `PostgreSQL`, ver, 'bin', 'pg_dump.exe')
    if (existsSync(p)) return p
  }
  return join(pf, 'PostgreSQL', '15', 'bin', 'pg_dump.exe')
}

const pgDump = resolvePgDump()
if (process.platform === 'win32' && !existsSync(pgDump)) {
  console.error('Không thấy pg_dump — cài PostgreSQL 17 (winget install PostgreSQL.PostgreSQL.17) hoặc set PG_DUMP_PATH.')
  process.exit(1)
}

const ver = spawnSync(pgDump, ['--version'], { encoding: 'utf8' })
console.log(ver.stdout?.trim() || pgDump)

const backupDir = resolve(process.cwd(), 'backups')
mkdirSync(backupDir, { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const outFile = resolve(backupDir, `pg-backup-${stamp}.dump`)

console.log('pg_dump →', outFile)
const r = spawnSync(
  pgDump,
  ['--dbname', uri, '--format', 'custom', '--file', outFile, '--no-owner'],
  { stdio: 'inherit' }
)
process.exit(r.status === 0 ? 0 : r.status ?? 1)
