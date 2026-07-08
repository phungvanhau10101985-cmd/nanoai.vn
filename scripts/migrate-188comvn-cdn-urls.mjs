#!/usr/bin/env node
/**
 * Đổi URL ảnh CDN shop 188: `188comvn.b-cdn.net` → `cdn.188.com.vn` (hoặc NEXT_PUBLIC_188_CDN_PUBLIC_BASE_URL).
 *
 * App đã rewrite lúc hiển thị (`resolveExternalImageDisplayUrl`) — script này cập nhật DB để
 * link lưu sẵn, embed, API partner và dashboard cũng dùng host mới.
 *
 * Biến môi trường:
 *   DATABASE_URL
 *   NEXT_PUBLIC_188_CDN_PUBLIC_BASE_URL hoặc SHOP188_CDN_PUBLIC_BASE_URL (mặc định https://cdn.188.com.vn)
 *
 * Chạy:
 *   node scripts/migrate-188comvn-cdn-urls.mjs           # dry-run
 *   node scripts/migrate-188comvn-cdn-urls.mjs --apply    # ghi DB
 */
import { readFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { pgQuery, pgEnd } from './pg-query.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const LEGACY_HOST = '188comvn.b-cdn.net'
const LIKE = `%${LEGACY_HOST}%`

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

function getTargetHost() {
  const raw =
    process.env.NEXT_PUBLIC_188_CDN_PUBLIC_BASE_URL?.trim() ||
    process.env.SHOP188_CDN_PUBLIC_BASE_URL?.trim() ||
    'https://cdn.188.com.vn'
  try {
    return new URL(raw.replace(/\/$/, '')).hostname
  } catch {
    return 'cdn.188.com.vn'
  }
}

function replaceHost(value) {
  const t = String(value ?? '')
  if (!t.includes(LEGACY_HOST)) return t
  return t.split(LEGACY_HOST).join(getTargetHost())
}

/** @type {{ table: string, column: string, kind?: 'jsonb' }[]} */
const TEXT_COLUMNS = [
  { table: 'messaging_partner_inventory', column: 'image_url' },
  { table: 'messaging_partner_inventory', column: 'material_detail_image_url' },
  { table: 'messaging_partner_inventory', column: 'real_use_image_url' },
  { table: 'messaging_partner_inventory', column: 'real_use_image_url_2' },
  { table: 'messaging_partner_inventory', column: 'stock_note' },
  { table: 'messaging_partner_order_lines', column: 'product_image_url' },
  { table: 'messaging_partner_order_lines', column: 'variant_image_urls' },
  { table: 'messaging_partner_orders', column: 'product_image_url' },
  { table: 'messaging_partner_orders', column: 'variant_image_urls' },
  { table: 'messaging_partner_payment_proofs', column: 'image_url' },
  { table: 'customer_care_messages', column: 'body' },
  { table: 'customer_care_messages', column: 'raw_payload', kind: 'jsonb' },
]

async function countMatches(table, column, kind) {
  if (kind === 'jsonb') {
    const rows = await pgQuery(
      `select count(*)::int as c from public.${table} where ${column}::text ilike $1`,
      [LIKE]
    )
    return rows[0]?.c ?? 0
  }
  const rows = await pgQuery(
    `select count(*)::int as c from public.${table} where ${column} ilike $1`,
    [LIKE]
  )
  return rows[0]?.c ?? 0
}

async function applyColumn(table, column, kind, apply) {
  const matches = await countMatches(table, column, kind)
  if (!matches) {
    console.log(`  ${table}.${column}: 0 hàng`)
    return 0
  }

  if (!apply) {
    console.log(`  ${table}.${column}: ${matches} hàng (dry-run)`)
    return matches
  }

  const targetHost = getTargetHost()
  if (kind === 'jsonb') {
    const res = await pgQuery(
      `update public.${table}
       set ${column} = replace(${column}::text, $1, $2)::jsonb
       where ${column}::text ilike $3
       returning id`,
      [LEGACY_HOST, targetHost, LIKE]
    )
    console.log(`  ${table}.${column}: đã cập nhật ${res.length} hàng`)
    return res.length
  }

  const res = await pgQuery(
    `update public.${table}
     set ${column} = replace(${column}, $1, $2)
     where ${column} ilike $3
     returning id`,
    [LEGACY_HOST, targetHost, LIKE]
  )
  console.log(`  ${table}.${column}: đã cập nhật ${res.length} hàng`)
  return res.length
}

async function main() {
  loadEnvFile('.env.local')
  loadEnvFile('.env')

  const apply = process.argv.includes('--apply')
  const targetHost = getTargetHost()

  if (!process.env.DATABASE_URL?.trim()) {
    console.error('Thiếu DATABASE_URL (.env.local hoặc .env).')
    process.exit(1)
  }

  console.log(`Legacy host: ${LEGACY_HOST}`)
  console.log(`Target host: ${targetHost}`)
  console.log(apply ? 'Mode: APPLY (ghi DB)' : 'Mode: dry-run (thêm --apply để ghi DB)')
  console.log('')

  let total = 0
  for (const col of TEXT_COLUMNS) {
    total += await applyColumn(col.table, col.column, col.kind, apply)
  }

  console.log('')
  console.log(apply ? `Hoàn tất — ${total} hàng đã cập nhật.` : `Dry-run — ${total} hàng sẽ được cập nhật khi chạy --apply.`)

  // Mẫu rewrite (không cần DB)
  const sample =
    'https://188comvn.b-cdn.net/O1CN016YQxVr1aSjUW8KrhX___2216344683329-0-cib_4065.jpg'
  console.log('')
  console.log('Ví dụ rewrite:')
  console.log('  from:', sample)
  console.log('  to:  ', replaceHost(sample))

  await pgEnd()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
