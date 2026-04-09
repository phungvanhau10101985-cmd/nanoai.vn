#!/usr/bin/env node
/**
 * Chạy một file .sql lên DATABASE_URL (tiện cho script SQL một lần).
 *
 *   node scripts/pg-run-sql-file.mjs scripts/delete-worksheet-exercises-for-recreate.sql
 *   node scripts/pg-run-sql-file.mjs scripts/delete-worksheet-exercises-for-recreate.sql --apply
 *
 * Mặc định dry-run (in nội dung). --apply để thực thi.
 */
import { readFileSync, existsSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'
import { Pool } from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '..', '.env.local')

function loadEnvLocal() {
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
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

async function main() {
  loadEnvLocal()
  const dsn = process.env.DATABASE_URL?.trim()
  if (!dsn) {
    console.error('Thiếu DATABASE_URL')
    process.exit(1)
  }

  const fileArg = process.argv.find((a) => !a.startsWith('--') && a.endsWith('.sql'))
  if (!fileArg) {
    console.error('Usage: node scripts/pg-run-sql-file.mjs <path/to/file.sql> [--apply]')
    process.exit(1)
  }
  const filePath = resolve(process.cwd(), fileArg)
  if (!existsSync(filePath)) {
    console.error('Không tìm thấy file:', filePath)
    process.exit(1)
  }
  const sql = readFileSync(filePath, 'utf8')
  const apply = process.argv.includes('--apply')

  if (!apply) {
    console.log('--- SQL (dry-run, thêm --apply để chạy) ---\n')
    console.log(sql.slice(0, 8000))
    if (sql.length > 8000) console.log('\n... [truncated]')
    return
  }

  const pool = new Pool({ connectionString: dsn, max: 1 })
  try {
    await pool.query(sql)
    console.log('OK:', filePath)
  } finally {
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
