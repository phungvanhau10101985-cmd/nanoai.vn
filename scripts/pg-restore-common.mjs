/**
 * pg_restore từ dump custom (thường PG17 trên host cũ) có thể chứa SET transaction_timeout — PG15 không có GUC này.
 * Trên server < 17: xuất SQL (-f), bỏ dòng SET đó, chạy psql (không lỗi).
 * Trên server >= 17: gọi pg_restore trực tiếp (nhanh).
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

export function resolvePgRestoreBin() {
  if (process.env.PG_RESTORE_PATH && existsSync(process.env.PG_RESTORE_PATH)) {
    return process.env.PG_RESTORE_PATH
  }
  const pgBin = process.env.PG_BIN?.trim()
  if (pgBin) {
    const p = join(pgBin, process.platform === 'win32' ? 'pg_restore.exe' : 'pg_restore')
    if (existsSync(p)) return p
  }
  if (process.platform !== 'win32') return 'pg_restore'
  const pf = process.env.ProgramFiles || 'C:\\Program Files'
  for (const ver of ['18', '17', '16', '15']) {
    const p = join(pf, `PostgreSQL`, ver, 'bin', 'pg_restore.exe')
    if (existsSync(p)) return p
  }
  return join(pf, 'PostgreSQL', '15', 'bin', 'pg_restore.exe')
}

export function resolvePsqlNextTo(pgRestorePath) {
  const bin = dirname(pgRestorePath)
  const name = process.platform === 'win32' ? 'psql.exe' : 'psql'
  const p = join(bin, name)
  return existsSync(p) ? p : name
}

export function getServerMajorSync(dbUrl, psqlPath) {
  const r = spawnSync(psqlPath, ['-d', dbUrl, '-tAc', 'SHOW server_version_num'], {
    encoding: 'utf8',
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (r.status !== 0) return null
  const line = String(r.stdout || '')
    .trim()
    .split(/\r?\n/)[0]
  const v = parseInt(line, 10)
  if (Number.isNaN(v)) return null
  return Math.floor(v / 10000)
}

/** Bỏ SET transaction_timeout (PG17+) khỏi script plain SQL — an toàn cho PG15. */
export function stripTransactionTimeoutFromRestoreSql(sql) {
  return sql.replace(
    /^\s*SET\s+(?:LOCAL\s+|SESSION\s+)?transaction_timeout\b[^;]*;[\r\n]*/gim,
    ''
  )
}

/**
 * @param {object} o
 * @param {string} o.dbUrl
 * @param {string} o.absDump - đường dẫn tuyệt đối tới file .dump
 * @param {string[]} o.pgRestoreMiddleArgs - ví dụ ['--verbose','--no-owner','--no-acl'] + optional --clean / -n ...
 */
export function runPgRestoreOrSqlPipeline(o) {
  const { dbUrl, absDump, pgRestoreMiddleArgs } = o
  const pgRestorePath = resolvePgRestoreBin()
  const psqlPath = resolvePsqlNextTo(pgRestorePath)

  if (process.env.PG_RESTORE_SQL_PIPELINE === '0') {
    return spawnSync(
      pgRestorePath,
      ['--dbname', dbUrl, ...pgRestoreMiddleArgs, absDump],
      { stdio: 'inherit', env: process.env }
    )
  }

  const major = getServerMajorSync(dbUrl, psqlPath)
  const usePipeline = major == null || major < 17

  if (!usePipeline) {
    console.log('Server PostgreSQL >= 17 — pg_restore trực tiếp.')
    return spawnSync(
      pgRestorePath,
      ['--dbname', dbUrl, ...pgRestoreMiddleArgs, absDump],
      { stdio: 'inherit', env: process.env }
    )
  }

  mkdirSync(resolve(process.cwd(), '.cache'), { recursive: true })
  const stamp = Date.now()
  const rawSql = resolve(process.cwd(), '.cache', `pg-restore-${stamp}-raw.sql`)
  const filteredSql = resolve(process.cwd(), '.cache', `pg-restore-${stamp}-filtered.sql`)

  const exportArgs = ['-f', rawSql, ...pgRestoreMiddleArgs, absDump]
  console.log(
    'PostgreSQL < 17 — xuất SQL, bỏ SET transaction_timeout, chạy psql (tránh lỗi trên PG15).'
  )
  let r = spawnSync(pgRestorePath, exportArgs, { stdio: 'inherit', env: process.env })
  if (r.status !== 0) return r

  let sql
  try {
    sql = readFileSync(rawSql, 'utf8')
  } catch (e) {
    console.error(e.message)
    return { status: 1, error: e }
  }

  const out = stripTransactionTimeoutFromRestoreSql(sql)
  writeFileSync(filteredSql, out, 'utf8')
  try {
    unlinkSync(rawSql)
  } catch {
    /* */
  }

  const stopOnErr = process.env.PG_SQL_ON_ERROR_STOP !== '0' ? '1' : '0'
  r = spawnSync(
    psqlPath,
    ['-d', dbUrl, '-v', `ON_ERROR_STOP=${stopOnErr}`, '-f', filteredSql],
    { stdio: 'inherit', env: process.env }
  )
  try {
    unlinkSync(filteredSql)
  } catch {
    /* */
  }
  return r
}
