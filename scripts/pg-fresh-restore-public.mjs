/**
 * Một lần: chọn server (ưu tiên PG17:5433 nếu đăng nhập được),
 * đảm bảo pgvector trên đúng major, tạo DB mới, compat role/auth.uid (dump hosted cũ),
 * CREATE EXTENSION vector, restore chỉ schema public.
 *
 *   node scripts/pg-fresh-restore-public.mjs [path/to/file.dump]
 *
 * Env:
 *   DATABASE_URL — bắt buộc
 *   DATABASE_URL_PG17 — nếu set: dùng URL này làm server đích (bỏ qua auto 5433)
 *   PG_FRESH_DB_NAME — tên DB mới (mặc định thudo_restored)
 *   PG_FRESH_SKIP_PG17 — 1 = không thử cổng 5433
 */
import pg, { escapeIdentifier } from 'pg'
import { createRequire } from 'module'
import { spawnSync } from 'node:child_process'
import { runPgRestoreOrSqlPipeline, resolvePgRestoreBin } from './pg-restore-common.mjs'
import { existsSync, readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs'
import { resolve, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'

const require = createRequire(import.meta.url)
const parseMod = require('pg-connection-string')
const __dirname = dirname(fileURLToPath(import.meta.url))

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

function clientConfigToUrl(cfg) {
  const user = cfg.user || 'postgres'
  const pass = cfg.password ?? ''
  const host = cfg.host || '127.0.0.1'
  const port = cfg.port ?? 5432
  const db = cfg.database || 'postgres'
  const auth = `${encodeURIComponent(user)}:${encodeURIComponent(pass)}`
  let q = ''
  if (cfg.sslmode) q = `?sslmode=${encodeURIComponent(String(cfg.sslmode))}`
  return `postgresql://${auth}@${host}:${port}/${db}${q}`
}

function vectorControlExists(pgMajor) {
  const pf = process.env.ProgramFiles || 'C:\\Program Files'
  return existsSync(join(pf, 'PostgreSQL', String(pgMajor), 'share', 'extension', 'vector.control'))
}

function ensurePgvectorDownloadAndHint(pgMajor) {
  if (pgMajor >= 17) {
    const r = spawnSync(process.execPath, [join(__dirname, 'pg-setup-pgvector-pg17.mjs')], {
      cwd: process.cwd(),
      stdio: 'inherit',
    })
    if (r.status !== 0) process.exit(r.status ?? 1)
    console.log('Nếu chưa copy DLL: (admin) powershell -ExecutionPolicy Bypass -File scripts\\install-pgvector-pg17-admin.ps1')
  } else {
    const r = spawnSync(process.execPath, [join(__dirname, 'pg-setup-pgvector-pg15.mjs')], {
      cwd: process.cwd(),
      stdio: 'inherit',
    })
    if (r.status !== 0) process.exit(r.status ?? 1)
    console.log('Nếu chưa copy DLL: (admin) powershell -ExecutionPolicy Bypass -File scripts\\install-pgvector-pg15-admin.ps1')
  }
}

async function tryConnect(cfg) {
  const c = new pg.Client(cfg)
  try {
    await c.connect()
    await c.query('SELECT 1')
    return true
  } catch {
    return false
  } finally {
    await c.end().catch(() => {})
  }
}

async function getServerMajor(adminCfg) {
  const c = new pg.Client(adminCfg)
  await c.connect()
  try {
    const { rows } = await c.query(`SELECT current_setting('server_version_num') AS n`)
    const n = parseInt(rows[0].n, 10)
    return Math.floor(n / 10000)
  } finally {
    await c.end()
  }
}

function mergeEnvDatabaseUrl(urlStr) {
  return { ...process.env, DATABASE_URL: urlStr }
}

function runNodeScript(relPath, env) {
  const r = spawnSync(process.execPath, [join(__dirname, relPath)], {
    cwd: process.cwd(),
    env,
    stdio: 'inherit',
  })
  return r.status ?? 1
}

function patchEnvLocal(newDatabaseUrl) {
  mkdirSync(resolve(process.cwd(), '.cache'), { recursive: true })
  const p = resolve(process.cwd(), '.env.local')
  if (!existsSync(p)) {
    console.warn('Không có .env.local — ghi', resolve(process.cwd(), '.cache', 'DATABASE_URL_FRESH.txt'))
    const out = resolve(process.cwd(), '.cache', 'DATABASE_URL_FRESH.txt')
    writeFileSync(out, `DATABASE_URL=${newDatabaseUrl}\n`, 'utf8')
    return
  }
  const bak = p + '.bak'
  try {
    copyFileSync(p, bak)
  } catch {
    /* ignore */
  }
  const lines = readFileSync(p, 'utf8').split(/\r?\n/)
  const idx = lines.findIndex((l) => /^\s*DATABASE_URL=/.test(l))
  const line = `DATABASE_URL=${JSON.stringify(newDatabaseUrl)}`
  if (idx >= 0) lines[idx] = line
  else lines.push(line)
  writeFileSync(p, lines.join('\n') + '\n', 'utf8')
  console.log('Đã cập nhật DATABASE_URL trong .env.local (bản sao: .env.local.bak nếu tạo được).')
}

const dumpPath =
  process.argv[2]?.trim() ||
  process.env.PG_DUMP_FILE ||
  'backups/pg-backup-2026-04-08T06-31-46.dump'

const absDump = resolve(process.cwd(), dumpPath)
if (!existsSync(absDump)) {
  console.error('Không thấy file dump:', absDump)
  process.exit(1)
}

const baseFromEnv = process.env.DATABASE_URL?.trim()
if (!baseFromEnv) {
  console.error('Thiếu DATABASE_URL')
  process.exit(1)
}

let workingCfg = parseMod.parseIntoClientConfig(baseFromEnv)
let usedPg17 = false

const explicitPg17 = process.env.DATABASE_URL_PG17?.trim()
if (explicitPg17) {
  workingCfg = parseMod.parseIntoClientConfig(explicitPg17)
  usedPg17 = true
  console.log('Dùng DATABASE_URL_PG17 làm server đích.')
} else if (process.env.PG_FRESH_SKIP_PG17 !== '1') {
  const p = workingCfg.port || 5432
  if (p !== 5433) {
    const tryCfg = { ...workingCfg, port: 5433, database: 'postgres' }
    if (await tryConnect(tryCfg)) {
      workingCfg = { ...workingCfg, port: 5433 }
      usedPg17 = true
      console.log('Đã kết nối PostgreSQL cổng 5433 (PG17) — dùng làm server cho DB mới.')
    } else {
      console.log('Không đăng nhập được cổng 5433 — dùng server hiện tại (thường PG15:5432).')
    }
  } else {
    usedPg17 = true
  }
}

const adminCfg = { ...workingCfg, database: 'postgres' }
if (!(await tryConnect(adminCfg))) {
  console.error('Không kết nối được tới postgres maintenance DB. Kiểm tra DATABASE_URL / firewall.')
  process.exit(1)
}

const pgMajor = await getServerMajor(adminCfg)
console.log('Phiên bản Postgres server (major):', pgMajor)

if (!vectorControlExists(pgMajor)) {
  console.log('Chưa thấy extension vector trong PostgreSQL', pgMajor, '— tải bản zip…')
  ensurePgvectorDownloadAndHint(pgMajor)
  if (!vectorControlExists(pgMajor)) {
    console.error(
      'Vẫn chưa có vector.control — chạy script install-pgvector-pg' +
        (pgMajor >= 17 ? '17' : '15') +
        '-admin.ps1 với quyền Administrator rồi chạy lại lệnh này.'
    )
    process.exit(1)
  }
}

const freshName = (process.env.PG_FRESH_DB_NAME || 'thudo_restored').replace(/[^a-zA-Z0-9_]/g, '_')
const adminClient = new pg.Client(adminCfg)
await adminClient.connect()
try {
  await adminClient.query(`DROP DATABASE IF EXISTS ${escapeIdentifier(freshName)} WITH (FORCE)`)
  await adminClient.query(`CREATE DATABASE ${escapeIdentifier(freshName)}`)
} finally {
  await adminClient.end()
}

const freshCfg = { ...workingCfg, database: freshName }
const freshUrl = clientConfigToUrl(freshCfg)
console.log('DB mới:', freshName, '→', freshUrl.replace(/:[^:@/]+@/, ':****@'))

process.env.DATABASE_URL = freshUrl

// Chỉ tạo schema auth trước restore (một số object trong dump cần auth tồn tại sớm).
// Không chạy full pg-ensure-auth-compat (auth.uid/role) — trùng với dump.
{
  const c = new pg.Client(freshCfg)
  await c.connect()
  try {
    await c.query('CREATE SCHEMA IF NOT EXISTS auth')
  } finally {
    await c.end()
  }
}

let code = runNodeScript('pg-ensure-pgvector.mjs', mergeEnvDatabaseUrl(freshUrl))
if (code !== 0) process.exit(code)

const pgRestore = resolvePgRestoreBin()
if (process.platform === 'win32' && !existsSync(pgRestore)) {
  console.error('Không thấy pg_restore')
  process.exit(1)
}

console.log('Restore -n auth -n public → DB mới')
const r = runPgRestoreOrSqlPipeline({
  dbUrl: freshUrl,
  absDump,
  pgRestoreMiddleArgs: ['--verbose', '--no-owner', '--no-acl', '-n', 'auth', '-n', 'public'],
})
const st = r.status ?? 1
if (st !== 0 && st !== 1) process.exit(st)

mkdirSync(resolve(process.cwd(), '.cache'), { recursive: true })
writeFileSync(
  resolve(process.cwd(), '.cache', 'DATABASE_URL_FRESH.txt'),
  `DATABASE_URL=${freshUrl}\n`,
  'utf8'
)
patchEnvLocal(freshUrl)

console.log('')
console.log('Xong. Trên PG15: pipeline SQL đã bỏ SET transaction_timeout — không còn lỗi đó.')
console.log('URL cũng lưu .cache/DATABASE_URL_FRESH.txt')
if (usedPg17) console.log('Đã dùng PG17 — lỗi transaction_timeout sẽ không còn từ mismatch 17 vs 15.')

process.exit(0)
