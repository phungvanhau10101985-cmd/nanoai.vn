/**
 * Đổ giá nhập cho shop gudo.vn khi chưa có giá gốc tệ.
 * Hàng clearance / thanh lý: cost_vnd = 0. Hàng còn lại: đảo giá bán về cost_cny theo lưới cào.
 *
 *   node scripts/backfill-gudo-import-cost.mjs
 *   node scripts/backfill-gudo-import-cost.mjs --apply
 *
 * Tỷ giá: VND_PER_CNY (mặc định 3580, khớp catalog nanoai).
 */
import { readFileSync } from 'node:fs'
import pg from 'pg'

const RATE = Number(process.env.VND_PER_CNY || 3580)
const APPLY = process.argv.includes('--apply')
const STEP = 10_000

function multiplier(cny) {
  if (!Number.isFinite(cny) || cny <= 0) return 0
  if (cny <= 90) return 3
  if (cny <= 100) return 2.9
  if (cny <= 120) return 2.8
  if (cny <= 140) return 2.7
  if (cny <= 280) return 2.6
  return 2.5
}

function forward(cny, coef, rate) {
  if (!Number.isFinite(cny) || cny <= 0 || coef <= 0 || rate <= 0) return null
  const rounded = Math.round(cny * coef * rate)
  return Math.ceil(rounded / STEP) * STEP
}

function listingVndToCny(unitVnd, rate) {
  const target = Math.round(unitVnd)
  if (!Number.isFinite(target) || target <= 0 || rate <= 0) return null
  const bands = [
    [0, 90, 3],
    [90, 100, 2.9],
    [100, 120, 2.8],
    [120, 140, 2.7],
    [140, 280, 2.6],
    [280, null, 2.5],
  ]
  const exact = []
  for (const [lo, hi, coef] of bands) {
    const upper = hi == null ? target / (coef * rate) + 2 : hi
    const start = lo <= 0 ? 1 : Math.round(lo * 100) + 1
    const end = Math.round(upper * 100)
    let left = start
    let right = end
    let found = null
    while (left <= right) {
      const mid = Math.floor((left + right) / 2)
      const value = forward(mid / 100, coef, rate)
      if (value == null || value < target) left = mid + 1
      else if (value > target) right = mid - 1
      else {
        found = mid
        left = mid + 1
      }
    }
    if (found != null) exact.push(found / 100)
  }
  if (exact.length) return Math.max(...exact)
  let guess = target / (3 * rate)
  for (let i = 0; i < 6; i += 1) {
    const coef = multiplier(guess)
    if (coef <= 0) return null
    guess = target / (coef * rate)
  }
  if (!Number.isFinite(guess) || guess <= 0) return null
  return Math.round(guess * 100) / 100
}

function databaseUrl() {
  const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  const line = env.split(/\r?\n/).find((row) => row.startsWith('DATABASE_URL='))
  if (!line) throw new Error('DATABASE_URL missing')
  let url = line.slice('DATABASE_URL='.length).trim()
  if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'"))) url = url.slice(1, -1)
  return url
}

const client = new pg.Client({ connectionString: databaseUrl() })
await client.connect()
try {
  const partners = await client.query(`
    select p.id
    from public.messaging_partners p
    join public.messaging_partner_custom_domains d on d.partner_id = p.id
    where d.hostname = 'gudo.vn'
  `)
  const ids = partners.rows.map((row) => row.id)
  if (!ids.length) throw new Error('Khong tim thay shop gudo.vn')
  const rows = await client.query(
    `
    select id, sku, price_amount, cost_cny, cost_vnd, is_clearance
    from public.messaging_partner_inventory
    where partner_id = any($1::uuid[])
    `,
    [ids],
  )
  const vndZero = []
  const cnyRows = []
  let already = 0
  let failed = 0
  for (const row of rows.rows) {
    if (row.cost_cny != null || row.cost_vnd != null) {
      already += 1
      continue
    }
    if (row.is_clearance === true) {
      vndZero.push(row.id)
      continue
    }
    const price = Number(row.price_amount)
    const amount = listingVndToCny(price, RATE)
    if (amount == null) {
      failed += 1
      continue
    }
    cnyRows.push({ id: row.id, sku: row.sku, price, amount })
  }
  console.log(`Ty gia: ${RATE}`)
  console.log(`Tong: ${rows.rows.length}`)
  console.log(`Da co gia nhap: ${already}`)
  console.log(`Clearance -> cost_vnd=0: ${vndZero.length}`)
  console.log(`Dao gia ban -> cost_cny: ${cnyRows.length}`)
  console.log(`Khong dao duoc: ${failed}`)
  for (const sample of cnyRows.slice(0, 5)) {
    console.log(`  ${sample.sku} price=${sample.price} -> cost_cny=${sample.amount}`)
  }
  if (!APPLY) {
    console.log('Chua ghi. Chay lai voi --apply.')
  } else {
    for (const id of vndZero) {
      await client.query(
        `update public.messaging_partner_inventory set cost_vnd = 0, updated_at = now() where id = $1 and cost_cny is null and cost_vnd is null`,
        [id],
      )
    }
    for (const row of cnyRows) {
      await client.query(
        `update public.messaging_partner_inventory set cost_cny = $2, updated_at = now() where id = $1 and cost_cny is null and cost_vnd is null`,
        [row.id, row.amount],
      )
    }
    console.log(`Da ghi cost_vnd=0: ${vndZero.length}`)
    console.log(`Da ghi cost_cny: ${cnyRows.length}`)
  }
} finally {
  await client.end()
}
