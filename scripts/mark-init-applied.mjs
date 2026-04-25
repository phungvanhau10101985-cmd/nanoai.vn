#!/usr/bin/env node
/**
 * Đánh dấu 20240101000000_init.sql đã áp khi DB đã có schema từ init cũ
 * nhưng bảng app_applied_sql_migrations trống / không có dòng init.
 */
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Pool } from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function loadEnvFile(name) {
  const p = join(root, name)
  if (!existsSync(p)) return
  for (const line of readFileSync(p, 'utf8').split('\n')) {
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

loadEnvFile('.env.local')
loadEnvFile('.env')
const dsn = process.env.DATABASE_URL?.trim()
if (!dsn) {
  console.error('Thiếu DATABASE_URL')
  process.exit(1)
}

const BOOTSTRAP = `
create table if not exists public.app_applied_sql_migrations (
  migration_filename text primary key,
  applied_at timestamptz not null default now()
);
`

const pool = new Pool({ connectionString: dsn, max: 1 })
try {
  await pool.query(BOOTSTRAP)
  await pool.query(
    `insert into public.app_applied_sql_migrations (migration_filename) values ($1)
     on conflict (migration_filename) do nothing`,
    ['20240101000000_init.sql']
  )
  console.log('OK: 20240101000000_init.sql marked applied (or already present).')
} finally {
  await pool.end()
}
