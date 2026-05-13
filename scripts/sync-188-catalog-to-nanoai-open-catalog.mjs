/**
 * Đồng bộ catalog web khách (REST JSON kiểu 188.com.vn) → NanoAI Open Catalog.
 *
 * Luồng: GET toàn bộ sản phẩm (phân trang) → map sang items[] → MỘT POST duy nhất
 * POST /api/messaging/partners/{partnerId}/inventory/open-sync
 *
 * QUAN TRỌNG: Open Catalog coi kho khách là nguồn chuẩn — mỗi POST là snapshot đầy đủ «items»;
 * hàng có trong Nano nhưng không còn trong payload bị xóa khỏi kho (theo SKU / tên). Không được
 * chia nhiều POST từng phần thiếu catalog (từng batch nhỏ sẽ xóa nhầm SKU không nằm trong batch).
 * Nếu body quá lớn,
 * tăng PARTNER_INVENTORY_OPEN_SYNC_MAX_BODY_BYTES trên server NanoAI và/hoặc rút gọn mô tả.
 *
 * Biến môi trường:
 *   NANOAI_BASE_URL          — vd https://nanoai.example.com (không slash cuối)
 *   NANOAI_PARTNER_ID        — UUID workspace shop trên NanoAI
 *   NANOAI_OPEN_SYNC_BEARER  — Bearer token (cùng khóa API tìm kiếm ảnh / Partner API)
 *   SOURCE_PRODUCTS_API_URL  — mặc định https://188.com.vn/api/v1/products/
 *   SOURCE_SITE_ORIGIN       — mặc định https://188.com.vn (để dựng link /san-pham/{slug})
 *   FETCH_LIMIT              — mặc định 500 (max 1000 theo doc 188)
 *   MAX_DESCRIPTION_CHARS    — mặc định 2000 (Open Catalog max ~4000)
 *
 * Web khách: `code` (VD B3630) làm `item_sku` kho; `product_id` (VD A594527028193a188b7422) → `remarketing_id`.
 * Thiếu `code` thì fallback `product_id` cho SKU.
 * Ghi chú tư vấn NanoAI (`consult_note`) khớp **product_info** từ web (chuỗi hoặc object → JSON text; max ~2000 ký tự).
 *
 * Dashboard: Messaging → Cài đặt AI → tab Kho — có bảng «tích hợp kho khách» lưu map trường vào DB (script CLI này chưa đọc DB; chỉ tham chiếu cho đội triển khai).
 *
 * Chạy (Windows): node scripts/sync-188-catalog-to-nanoai-open-catalog.mjs
 */

function env(name, fallback = '') {
  const v = process.env[name]
  return v != null && String(v).trim() !== '' ? String(v).trim() : fallback
}

function truncate(s, max) {
  const t = String(s ?? '')
  if (t.length <= max) return t
  return t.slice(0, max - 1) + '…'
}

/** NanoAI Open Catalog: consult_note tối đa ~2000 ký tự (đồng bộ với server). */
const CONSULT_NOTE_MAX = 2000

/** Web `product_info` có thể object lồng nhau — đưa vào ghi chú tư vấn dạng text. */
function productInfoToConsultText(pi) {
  if (pi == null) return ''
  if (typeof pi === 'string') return pi.trim()
  if (typeof pi === 'number' && Number.isFinite(pi)) return String(pi)
  if (typeof pi === 'boolean') return pi ? 'true' : 'false'
  try {
    if (typeof pi === 'object') return JSON.stringify(pi)
  } catch {
    /* ignore */
  }
  return String(pi).trim()
}

/** Map một object sản phẩm từ GET /api/v1/products/ (188) → item Open Catalog. */
function map188LikeProductToOpenItem(p, siteOrigin) {
  const slug = p.slug != null ? String(p.slug).trim() : ''
  const code = p.code != null ? String(p.code).trim() : ''
  const productId = p.product_id != null ? String(p.product_id).trim() : ''
  /** SKU kho ưu tiên `code`; fallback `product_id` khi không có mã ngắn. */
  const item_sku = code || productId || null

  const name = String(p.name ?? '').trim()
  if (!name) return null

  const description = truncate(String(p.description ?? '').trim(), parseInt(env('MAX_DESCRIPTION_CHARS', '2000'), 10) || 2000)

  const priceNum = typeof p.price === 'number' && Number.isFinite(p.price) ? p.price : NaN
  const price = Number.isFinite(priceNum) ? `${Math.round(priceNum).toLocaleString('vi-VN')}đ` : ''

  const main =
    (typeof p.main_image === 'string' && p.main_image.trim()) ||
    (Array.isArray(p.images) && p.images[0] ? String(p.images[0]).trim() : '') ||
    ''

  const sizes = Array.isArray(p.sizes) ? p.sizes.map((x) => String(x)) : []
  const stock_note = sizes.length ? `Size: ${sizes.join(', ')}` : ''

  const qtyRaw = p.available
  const stock_qty =
    typeof qtyRaw === 'number' && Number.isFinite(qtyRaw) ? Math.max(0, Math.floor(qtyRaw)) : 0

  const origin = siteOrigin.replace(/\/$/, '')
  const item_url = slug ? `${origin}/san-pham/${encodeURI(slug)}` : ''

  const consult_note = truncate(productInfoToConsultText(p.product_info), CONSULT_NOTE_MAX)

  const video =
    typeof p.video_link === 'string' && p.video_link.trim() ? String(p.video_link).trim() : ''

  const sortRaw = p.id
  let sort_order = parseInt(String(sortRaw ?? ''), 10)
  if (!Number.isFinite(sort_order)) sort_order = 100

  const is_active = p.is_active !== false

  const item = {
    item_sku,
    item_name: truncate(name, 500),
    description,
    stock_note,
    stock_qty,
    price,
    image: main ? { image_url_list: [main] } : undefined,
    item_url,
    consult_note,
    sort_order,
    item_status: is_active ? 'NORMAL' : 'UNLIST',
  }

  /** Remarketing / pixel: mã nguồn `product_id` (VD `A594527028193a188b7422`), không nhầm với `code`. */
  if (productId) item.remarketing_id = truncate(productId, 500)

  if (video) item.product_video_url = video

  return item
}

async function fetchAllProducts(productsUrl, limit) {
  const items = []
  let skip = 0
  let total = Infinity

  while (skip < total) {
    const u = new URL(productsUrl)
    u.searchParams.set('skip', String(skip))
    u.searchParams.set('limit', String(limit))
    u.searchParams.set('is_active', 'true')

    const res = await fetch(u, { headers: { Accept: 'application/json' } })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`GET ${u}: ${res.status} ${text.slice(0, 500)}`)
    }
    const data = await res.json()
    const batch = Array.isArray(data.products) ? data.products : []
    total = Number(data.total) || batch.length
    for (const p of batch) {
      items.push(p)
    }
    skip += limit
    console.warn(`[fetch] skip=${skip - limit} got=${batch.length} total_so_far=${items.length} catalog_total=${total}`)
    if (batch.length === 0) break
  }

  return items
}

async function main() {
  const nanoBase = env('NANOAI_BASE_URL')
  const partnerId = env('NANOAI_PARTNER_ID')
  const bearer = env('NANOAI_OPEN_SYNC_BEARER')
  const productsUrl = env('SOURCE_PRODUCTS_API_URL', 'https://188.com.vn/api/v1/products/')
  const siteOrigin = env('SOURCE_SITE_ORIGIN', 'https://188.com.vn')
  const limit = Math.min(1000, Math.max(1, parseInt(env('FETCH_LIMIT', '500'), 10) || 500))

  if (!nanoBase || !partnerId || !bearer) {
    console.error(
      'Thiếu biến môi trường: NANOAI_BASE_URL, NANOAI_PARTNER_ID, NANOAI_OPEN_SYNC_BEARER (xem đầu file script).'
    )
    process.exit(1)
  }

  console.warn('[sync] Đang tải catalog nguồn…')
  const raw = await fetchAllProducts(productsUrl, limit)

  const openItems = []
  for (const p of raw) {
    const it = map188LikeProductToOpenItem(p, siteOrigin)
    if (it) openItems.push(it)
  }

  const body = {
    request_id: `188-sync-${new Date().toISOString()}`,
    items: openItems,
  }

  const json = JSON.stringify(body)
  const bytes = Buffer.byteLength(json, 'utf8')
  console.warn(`[sync] items=${openItems.length} json_bytes=${bytes}`)

  const syncUrl = `${nanoBase.replace(/\/$/, '')}/api/messaging/partners/${partnerId}/inventory/open-sync`
  const res = await fetch(syncUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${bearer}`,
      'Content-Type': 'application/json',
      'X-Defer-Inventory-Embeddings': 'true',
    },
    body: json,
  })

  const outText = await res.text()
  let parsed = null
  try {
    parsed = JSON.parse(outText)
  } catch {
    /* ignore */
  }

  if (!res.ok) {
    console.error('[sync] Lỗi Open Catalog:', res.status, outText.slice(0, 2000))
    process.exit(1)
  }

  console.warn('[sync] OK:', parsed ?? outText)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
