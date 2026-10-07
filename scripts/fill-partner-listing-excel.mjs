/**
 * Đối chiếu file Excel 41 cột (xuất hàng đợi cào) với kho một shop.
 * Chỉ điền cột đang trống trên server. Không ghi đè mô tả, ảnh, size, màu đã có.
 *
 *   node scripts/fill-partner-listing-excel.mjs --slug=gudo-vn-3f93 --file="C:\...\listing.xlsx"
 *   node scripts/fill-partner-listing-excel.mjs --slug=gudo-vn-3f93 --file="..." --apply
 *
 * DATABASE_URL lấy từ .env.local (hoặc env sẵn). --apply mới ghi Postgres.
 */
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'))
const { Pool } = require('pg')
const XLSX = require('xlsx')

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnvLocal() {
  const envPath = join(__dirname, '..', '.env.local')
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

function arg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3).trim() : ''
}

function cellText(value) {
  if (value == null) return ''
  const text = String(value).trim()
  if (!text || text.toLowerCase() === 'null' || text.toLowerCase() === 'none') return ''
  return text
}

function cellList(value) {
  if (Array.isArray(value)) return value.filter((item) => item != null && item !== '')
  const text = cellText(value)
  if (!text || text === '[]' || text === '{}') return []
  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) return parsed.filter((item) => item != null && item !== '')
    if (parsed && typeof parsed === 'object') return [parsed]
  } catch {
    return text ? [text] : []
  }
  return []
}

function cellObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value
  const text = cellText(value)
  if (!text || text === '{}' || text === '[]') return null
  try {
    const parsed = JSON.parse(text)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
  } catch {
    return null
  }
  return null
}

function cellNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const text = cellText(value).replace(/\s/g, '').replace(/,/g, '')
  if (!text) return null
  const n = Number(text)
  return Number.isFinite(n) ? n : null
}

function sourceId(value) {
  const text = cellText(value)
  return /^[AT]\d+$/.test(text) ? text : ''
}

function longerText(a, b) {
  return cellText(b).length > cellText(a).length ? cellText(b) : cellText(a)
}

function longerList(a, b) {
  return b.length > a.length ? b : a
}

function readExcel(filePath) {
  const book = XLSX.readFile(filePath, { cellDates: false })
  const sheet = book.Sheets[book.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false })
  const byId = new Map()
  let skipped = 0
  for (const row of rows) {
    const id = sourceId(row.id)
    if (!id) {
      skipped += 1
      continue
    }
    const next = {
      id,
      name: cellText(row.name).slice(0, 500),
      sku: cellText(row.sku).slice(0, 120),
      description: cellText(row.pro_content).slice(0, 20000),
      price: cellNumber(row.price),
      image: cellText(row.main_image).slice(0, 2000),
      gallery: cellList(row.gallery_images).map((item) => cellText(item)).filter(Boolean).slice(0, 200),
      detail: cellList(row.detail_images).map((item) => cellText(item)).filter(Boolean).slice(0, 200),
      colors: cellList(row.Variant).slice(0, 80),
      sizes: cellList(row.sizes).map((item) => cellText(item)).filter(Boolean).slice(0, 80),
      categoryL1: cellText(row['Main Category']).slice(0, 200),
      categoryL2: cellText(row.Subcategory).slice(0, 200),
      categoryL3: cellText(row['Sub-subcategory']).slice(0, 200),
      material: cellText(row.Material).slice(0, 8000),
      style: cellText(row.Style).slice(0, 100),
      color: cellText(row.Color).slice(0, 500),
      occasion: cellText(row.Occasion).slice(0, 100),
      productInfo: cellObject(row.product_info),
      chineseName: cellText(row.chinese_name).slice(0, 500),
      shopNameChinese: cellText(row.shop_name_chinese).slice(0, 200),
      productUrl: cellText(row.product_url).slice(0, 2000),
      costCny: cellNumber(row.cost_cny),
    }
    const prev = byId.get(id)
    if (!prev) {
      byId.set(id, next)
      continue
    }
    byId.set(id, {
      id,
      name: longerText(prev.name, next.name),
      sku: longerText(prev.sku, next.sku),
      description: longerText(prev.description, next.description),
      price: next.price != null && (prev.price == null || next.price > prev.price) ? next.price : prev.price,
      image: longerText(prev.image, next.image),
      gallery: longerList(prev.gallery, next.gallery),
      detail: longerList(prev.detail, next.detail),
      colors: longerList(prev.colors, next.colors),
      sizes: longerList(prev.sizes, next.sizes),
      categoryL1: longerText(prev.categoryL1, next.categoryL1),
      categoryL2: longerText(prev.categoryL2, next.categoryL2),
      categoryL3: longerText(prev.categoryL3, next.categoryL3),
      material: longerText(prev.material, next.material),
      style: longerText(prev.style, next.style),
      color: longerText(prev.color, next.color),
      occasion: longerText(prev.occasion, next.occasion),
      productInfo: next.productInfo && Object.keys(next.productInfo).length >= Object.keys(prev.productInfo || {}).length
        ? next.productInfo
        : prev.productInfo,
      chineseName: longerText(prev.chineseName, next.chineseName),
      shopNameChinese: longerText(prev.shopNameChinese, next.shopNameChinese),
      productUrl: longerText(prev.productUrl, next.productUrl),
      costCny: next.costCny != null ? next.costCny : prev.costCny,
    })
  }
  return { products: [...byId.values()], skipped }
}

function shownText(column, snapshotValue) {
  return cellText(column) || cellText(snapshotValue)
}

function shownList(column, snapshotValue) {
  if (Array.isArray(column) && column.length > 0) return column
  return Array.isArray(snapshotValue) ? snapshotValue : []
}

function shownObject(column, snapshotValue) {
  if (column && typeof column === 'object' && !Array.isArray(column) && Object.keys(column).length > 0) return column
  if (snapshotValue && typeof snapshotValue === 'object' && !Array.isArray(snapshotValue) && Object.keys(snapshotValue).length > 0) {
    return snapshotValue
  }
  return null
}

function planFill(fileRow, dbRow) {
  const snap = dbRow.catalog_json && typeof dbRow.catalog_json === 'object' ? dbRow.catalog_json : {}
  const sets = []
  const params = []
  const snapPatch = {}
  const fields = []

  const addText = (field, column, snapKey, value, limit) => {
    const next = cellText(value).slice(0, limit)
    if (!next || shownText(dbRow[column], snap[snapKey])) return
    params.push(next)
    sets.push(`${column} = $${params.length}`)
    snapPatch[snapKey] = next
    fields.push(field)
  }
  const addJson = (field, column, snapKey, value) => {
    const next = value
    const empty = Array.isArray(next) ? next.length === 0 : !next
    if (empty) return
    const current = Array.isArray(next)
      ? shownList(dbRow[column], snap[snapKey])
      : shownObject(dbRow[column], snap[snapKey])
    if (Array.isArray(next) ? current.length > 0 : current) return
    params.push(JSON.stringify(next))
    sets.push(`${column} = $${params.length}::jsonb`)
    snapPatch[snapKey] = next
    fields.push(field)
  }

  addText('name', 'name', 'name', fileRow.name, 500)
  addText('sku', 'sku', 'code', fileRow.sku, 120)
  addText('description', 'description', 'description', fileRow.description, 20000)
  addText('image', 'image_url', 'main_image', fileRow.image, 2000)
  addText('product_url', 'product_url', 'link_default', fileRow.productUrl, 2000)
  addText('category_l1', 'category_l1', 'category', fileRow.categoryL1, 200)
  addText('category_l2', 'category_l2', 'subcategory', fileRow.categoryL2, 200)
  addText('category_l3', 'category_l3', 'sub_subcategory', fileRow.categoryL3, 200)
  addText('material', 'material_note', 'material', fileRow.material, 8000)
  addText('style', 'style', 'style', fileRow.style, 100)
  addText('color', 'color_summary', 'color', fileRow.color, 500)
  addText('occasion', 'occasion', 'occasion', fileRow.occasion, 100)
  addText('chinese_name', 'chinese_name', 'chinese_name', fileRow.chineseName, 500)
  addText('shop_name_chinese', 'source_shop_name_chinese', 'shop_name_chinese', fileRow.shopNameChinese, 200)
  addJson('gallery', 'gallery_urls', 'images', fileRow.gallery)
  addJson('detail', 'detail_image_urls', 'gallery', fileRow.detail)
  addJson('colors', 'colors_json', 'colors', fileRow.colors)
  addJson('sizes', 'sizes_json', 'sizes', fileRow.sizes)
  addJson('product_info', 'product_info_json', 'product_info', fileRow.productInfo)

  const priceMissing = !(Number(dbRow.price_amount) > 0) && !cellText(dbRow.price_hint) && !(Number(snap.price) > 0)
  if (priceMissing && fileRow.price != null && fileRow.price > 0) {
    const amount = Math.round(fileRow.price)
    params.push(String(amount))
    sets.push(`price_hint = $${params.length}`)
    params.push(amount)
    sets.push(`price_amount = $${params.length}`)
    snapPatch.price = amount
    fields.push('price')
  }
  if (dbRow.cost_cny == null && snap.cost_cny == null && fileRow.costCny != null) {
    params.push(fileRow.costCny)
    sets.push(`cost_cny = $${params.length}`)
    snapPatch.cost_cny = fileRow.costCny
    fields.push('cost_cny')
  }

  if (!sets.length) return null
  params.push(JSON.stringify(snapPatch))
  sets.push(`catalog_json = coalesce(catalog_json, '{}'::jsonb) || $${params.length}::jsonb`)
  sets.push('updated_at = now()')
  params.push(dbRow.id)
  const idParam = params.length
  params.push(dbRow.partner_id)
  return {
    fields,
    text: `update public.messaging_partner_inventory set ${sets.join(', ')} where id = $${idParam}::uuid and partner_id = $${params.length}::uuid`,
    params,
  }
}

async function bumpCache(partnerId, slug) {
  const redisUrl = process.env.REDIS_URL?.trim()
  if (!redisUrl) return
  const Redis = require('ioredis')
  const redis = new Redis(redisUrl, { maxRetriesPerRequest: 1, connectTimeout: 4000 })
  try {
    await redis.incr(`pw:inv:${partnerId}:ver`)
    if (slug) await redis.incr(`pw:site:${slug}:ver`)
  } finally {
    redis.disconnect()
  }
}

async function main() {
  loadEnvLocal()
  const slug = arg('slug') || 'gudo-vn-3f93'
  const file = arg('file')
  const apply = process.argv.includes('--apply')
  if (!file) {
    console.error('Thiếu --file=')
    process.exit(1)
  }
  if (!process.env.DATABASE_URL?.trim()) {
    console.error('Thiếu DATABASE_URL')
    process.exit(1)
  }
  const { products, skipped } = readExcel(file)
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
  const site = await pool.query(
    `select partner_id::text from public.messaging_partner_websites where site_slug = $1 limit 1`,
    [slug]
  )
  const partnerId = site.rows[0]?.partner_id
  if (!partnerId) {
    console.error(`Không thấy website slug ${slug}`)
    await pool.end()
    process.exit(1)
  }
  const ids = products.map((row) => row.id)
  const existing = await pool.query(
    `select id::text, partner_id::text, remarketing_id, name, sku, description, image_url, product_url,
            price_hint, price_amount, category_l1, category_l2, category_l3, material_note, style,
            color_summary, occasion, chinese_name, source_shop_name_chinese, cost_cny,
            gallery_urls, detail_image_urls, colors_json, sizes_json, product_info_json, catalog_json
     from public.messaging_partner_inventory
     where partner_id = $1::uuid and remarketing_id = any($2::text[])`,
    [partnerId, ids]
  )
  const dbById = new Map(existing.rows.map((row) => [row.remarketing_id, row]))
  const missing = []
  const plans = []
  const fieldCounts = {}
  for (const product of products) {
    const dbRow = dbById.get(product.id)
    if (!dbRow) {
      missing.push(product.id)
      continue
    }
    const plan = planFill(product, dbRow)
    if (!plan) continue
    plans.push(plan)
    for (const field of plan.fields) fieldCounts[field] = (fieldCounts[field] || 0) + 1
  }
  console.log(JSON.stringify({
    slug,
    fileProducts: products.length,
    skippedRows: skipped,
    onServer: existing.rows.length,
    missingOnServer: missing.length,
    missingSample: missing.slice(0, 12),
    rowsToFill: plans.length,
    fields: fieldCounts,
    apply,
  }, null, 2))
  if (!apply || plans.length === 0) {
    await pool.end()
    return
  }
  const client = await pool.connect()
  try {
    await client.query('begin')
    for (const plan of plans) await client.query(plan.text, plan.params)
    await client.query('commit')
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
  await bumpCache(partnerId, slug)
  console.log(JSON.stringify({ updated: plans.length }))
  await pool.end()
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
