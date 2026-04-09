#!/usr/bin/env node
/**
 * Xóa toàn bộ DỮ LIỆU trong Postgres (TRUNCATE), không DROP bảng — dự án “sạch trắng”, chỉ còn hạ tầng (schema, extension, …).
 *
 * Mặc định: mọi schema ứng dụng (auth, public, storage, realtime, vault, extensions, … — không phải pg_* / system).
 * Dry-run trước; thêm --apply để thực thi.
 *
 * Loại trừ mặc định:
 *   - public.spatial_ref_sys (PostGIS SRID) — dùng --include-postgis-ref để truncate luôn
 *   - Các bảng lịch sử migration trong public — dùng --nuke-migration-meta để xóa luôn
 *   - storage.migrations, realtime.migrations (trừ khi --nuke-migration-meta)
 *
 * Chạy:
 *   node scripts/pg-truncate-all-data.mjs
 *   node scripts/pg-truncate-all-data.mjs --apply
 *   node scripts/pg-truncate-all-data.mjs --schemas=public,auth --apply
 *   DATABASE_URL=... node scripts/pg-truncate-all-data.mjs --apply --force
 */

import { readFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { pgQuery, pgQueryRaw, pgEnd } from './pg-query.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '..', '.env.local')

const EXCLUDE_FQ_MIGRATION_PUBLIC = new Set([
  'public.schema_migrations',
  'public.supabase_migrations',
  'public._prisma_migrations',
])

function loadEnvLocal() {
  if (!existsSync(envPath)) return
  const envContent = readFileSync(envPath, 'utf8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const k = trimmed.slice(0, eq).trim()
    let v = trimmed.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    if (!process.env[k]) process.env[k] = v
  }
}

function quoteIdentPart(s) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(s)) {
    throw new Error(`Invalid SQL identifier segment: ${s}`)
  }
  return `"${String(s).replace(/"/g, '""')}"`
}

function fq(schema, name) {
  return `${quoteIdentPart(schema)}.${quoteIdentPart(name)}`
}

async function listAllAppSchemaNames() {
  const rows = await pgQuery(
    `select nspname::text as name
     from pg_namespace
     where nspname not in ('pg_catalog', 'information_schema', 'pg_toast')
       and nspname !~ '^pg_'
     order by nspname`
  )
  return rows.map((r) => r.name)
}

function parseSchemasArg() {
  const raw = process.argv.find((a) => a.startsWith('--schemas='))
  if (!raw) return null
  const s = raw
    .slice('--schemas='.length)
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
  return s.length ? s : null
}

async function listTablesToTruncate(schemas, { nukeMigrationMeta, includePostgisRef }) {
  const rows = await pgQuery(
    `select n.nspname::text as schema, c.relname::text as name
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     where (c.relkind = 'p' or (c.relkind = 'r' and not c.relispartition))
       and n.nspname = any($1::text[])
     order by n.nspname, c.relname`,
    [schemas]
  )

  const out = []
  for (const r of rows) {
    const key = `${r.schema}.${r.name}`
    if (!includePostgisRef && r.schema === 'public' && r.name === 'spatial_ref_sys') continue
    if (!nukeMigrationMeta && EXCLUDE_FQ_MIGRATION_PUBLIC.has(key)) continue
    if (!nukeMigrationMeta && (r.schema === 'storage' || r.schema === 'realtime') && r.name === 'migrations') continue
    out.push({ schema: r.schema, name: r.name, fq: fq(r.schema, r.name) })
  }
  return out
}

async function main() {
  loadEnvLocal()
  if (!process.env.DATABASE_URL?.trim()) {
    console.error('Thiếu DATABASE_URL (ví dụ trong .env.local hoặc biến môi trường).')
    process.exit(1)
  }

  const apply = process.argv.includes('--apply')
  const force = process.argv.includes('--force')
  const nukeMigrationMeta = process.argv.includes('--nuke-migration-meta')
  const includePostgisRef = process.argv.includes('--include-postgis-ref')

  const isProd = process.env.NODE_ENV === 'production'
  if (isProd && apply && !force) {
    console.error('NODE_ENV=production: thêm --force để xác nhận (sau khi đã backup).')
    process.exit(1)
  }

  let schemas = parseSchemasArg()
  if (!schemas) {
    schemas = await listAllAppSchemaNames()
  }

  if (schemas.length === 0) {
    console.error('Không tìm thấy schema ứng dụng nào.')
    process.exit(1)
  }

  const tables = await listTablesToTruncate(schemas, { nukeMigrationMeta, includePostgisRef })

  if (tables.length === 0) {
    console.log('Không có bảng nào cần truncate (sau khi loại trừ).')
    await pgEnd()
    return
  }

  console.log('=== TRUNCATE toàn bộ dữ liệu (giữ nguyên CREATE TABLE / extension) ===\n')
  console.log(`Schemas (${schemas.length}): ${schemas.join(', ')}`)
  if (nukeMigrationMeta) {
    console.log('Đã bật: --nuke-migration-meta (xóa luôn lịch sử migration public — có thể cần chạy lại migration từ đầu).')
  } else {
    console.log('Giữ lại: public.supabase_migrations / schema_migrations / _prisma_migrations. Dùng --nuke-migration-meta để xóa luôn.')
  }
  if (!includePostgisRef) {
    console.log('Giữ lại: public.spatial_ref_sys (PostGIS). Dùng --include-postgis-ref để truncate luôn.')
  }
  if (!nukeMigrationMeta) {
    console.log('Giữ lại: storage.migrations, realtime.migrations. Dùng --nuke-migration-meta để xóa luôn.')
  }
  console.log(`\nSố bảng sẽ TRUNCATE: ${tables.length}\n`)
  for (const t of tables) {
    console.log(`  ${t.schema}.${t.name}`)
  }

  if (!apply) {
    console.log('\nDry-run. Thêm --apply để thực thi.')
    await pgEnd()
    return
  }

  const sql = `truncate table ${tables.map((t) => t.fq).join(', ')} restart identity cascade`
  console.log('\nĐang TRUNCATE (một lệnh, CASCADE)...')
  await pgQueryRaw(sql)
  console.log('Xong: tài khoản (auth), public, storage, … đã trống; chỉ còn hạ tầng DB + cấu trúc bảng.')
  await pgEnd()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
