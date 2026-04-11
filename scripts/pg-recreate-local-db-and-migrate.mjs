#!/usr/bin/env node
/**
 * LOCAL ONLY: DROP + CREATE lại database trong DATABASE_URL, rồi npm run db:migrate:push.
 * Chỉ chạy khi hostname là 127.0.0.1 / localhost / ::1 (tránh nhầm production).
 *
 *   node scripts/pg-recreate-local-db-and-migrate.mjs --apply
 *
 * Yêu cầu: DATABASE_URL trong .env.local hoặc .env
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const __scriptDir = dirname(fileURLToPath(import.meta.url))
const BOOTSTRAP_AUTH_SQL = join(__scriptDir, 'bootstrap-empty-db-auth.sql')
const BOOTSTRAP_STORAGE_SQL = join(__scriptDir, 'bootstrap-storage-stub.sql')

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function loadEnvFile(name) {
  const p = join(root, name)
  if (!existsSync(p)) return
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq < 0) continue
    const k = t.slice(0, eq).trim()
    let v = t.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!process.env[k]) process.env[k] = v
  }
}

loadEnvFile('.env.local')
loadEnvFile('.env')

const APPLY = process.argv.includes('--apply')

function parseDatabaseUrl(raw) {
  const s = raw.trim()
  let u
  try {
    u = new URL(s.replace(/^postgresql:/i, 'postgres:'))
  } catch {
    throw new Error('DATABASE_URL không hợp lệ')
  }
  const host = u.hostname
  const port = u.port ? parseInt(u.port, 10) : 5432
  let db = u.pathname.replace(/^\//, '').split('?')[0]
  if (!db) throw new Error('Thiếu tên database trong DATABASE_URL')
  const user = decodeURIComponent(u.username || '')
  const password = u.password != null ? decodeURIComponent(u.password) : ''
  return { host, port, database: db, user, password, ssl: u.searchParams.get('sslmode') === 'require' }
}

function isLocalHost(host) {
  const h = String(host).toLowerCase()
  return h === 'localhost' || h === '127.0.0.1' || h === '::1'
}

async function main() {
  const dsn = process.env.DATABASE_URL?.trim()
  if (!dsn) {
    console.error('Thiếu DATABASE_URL (.env.local / .env)')
    process.exit(1)
  }

  let cfg
  try {
    cfg = parseDatabaseUrl(dsn)
  } catch (e) {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  }

  if (!isLocalHost(cfg.host)) {
    console.error(`Từ chối: host "${cfg.host}" không phải máy local. Chỉ hỗ trợ localhost / 127.0.0.1 / ::1.`)
    process.exit(1)
  }

  const forbidden = new Set(['postgres', 'template0', 'template1'])
  if (forbidden.has(cfg.database)) {
    console.error(`Từ chối: không được recreate database hệ thống "${cfg.database}".`)
    process.exit(1)
  }

  if (!APPLY) {
    console.log('Dry-run. Sẽ xóa và tạo lại database:', cfg.database)
    console.log('Trên server:', `${cfg.host}:${cfg.port}, user:`, cfg.user || '(default)')
    console.log('\nChạy thật: node scripts/pg-recreate-local-db-and-migrate.mjs --apply')
    process.exit(0)
  }

  const adminCfg = {
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: 'postgres',
    ssl: cfg.ssl ? { rejectUnauthorized: false } : false,
  }

  function ident(name) {
    if (!/^[a-zA-Z0-9_]+$/.test(name)) {
      throw new Error(`Tên database không hợp lệ cho lệnh SQL an toàn: ${name}`)
    }
    return '"' + name.replace(/"/g, '""') + '"'
  }

  const client = new pg.Client(adminCfg)
  await client.connect()
  try {
    await client.query(`select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()`, [
      cfg.database,
    ])
    await client.query(`drop database if exists ${ident(cfg.database)}`)
    // Owner = user đang kết nối (thường trùng DATABASE_URL)
    await client.query(`create database ${ident(cfg.database)}`)
    console.log('OK: đã tạo lại database', cfg.database)
  } finally {
    await client.end()
  }

  const appClient = new pg.Client({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    ssl: cfg.ssl ? { rejectUnauthorized: false } : false,
  })
  await appClient.connect()
  try {
    if (!existsSync(BOOTSTRAP_AUTH_SQL)) {
      throw new Error('Thiếu file: scripts/bootstrap-empty-db-auth.sql')
    }
    await appClient.query(readFileSync(BOOTSTRAP_AUTH_SQL, 'utf8'))
    console.log('OK: bootstrap auth.users (scripts/bootstrap-empty-db-auth.sql)')
    if (!existsSync(BOOTSTRAP_STORAGE_SQL)) {
      throw new Error('Thiếu file: scripts/bootstrap-storage-stub.sql')
    }
    await appClient.query(readFileSync(BOOTSTRAP_STORAGE_SQL, 'utf8'))
    console.log('OK: bootstrap storage.buckets/objects (scripts/bootstrap-storage-stub.sql)')
  } finally {
    await appClient.end()
  }

  const compat = spawnSync('npm', ['run', 'pg:ensure-auth-compat'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env },
    shell: true,
  })
  if (compat.status !== 0) {
    console.error('[CẢNH BÁO] pg:ensure-auth-compat lỗi — migrate có thể vẫn chạy được tùy DB.')
  }

  const r = spawnSync('npm', ['run', 'db:migrate:push'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env },
    shell: true,
  })
  if (r.status !== 0) {
    process.exit(r.status ?? 1)
  }
  console.log('\nXong: DB sạch + migration đã áp. Kiểm tra: npm run db:migrate:status')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
