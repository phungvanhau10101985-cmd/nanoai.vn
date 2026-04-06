/**
 * Cổng «Open Catalog» — body JSON theo quy ước gần marketplace (Shopee-style field names),
 * để bất kỳ backend shop nào cũng có thể đẩy sản phẩm vào kho NanoAI (`messaging_partner_inventory`).
 *
 * Không phải proxy Shopee; đây là **chuẩn NanoAI** lấy cảm hứng từ tên trường phổ biến (item_sku, item_name, item_status, image_url_list).
 */

import type { InventoryExcelInsert } from '@/lib/messaging/partner-inventory-excel'
import {
  inventoryNameMatchKey,
  inventorySkuMatchKey,
  validateInventoryImageUrl,
  validateInventoryProductUrl,
} from '@/lib/messaging/partner-inventory-excel'
import type { Database } from '@/types/database.types'

export const MAX_OPEN_CATALOG_ITEMS_PER_REQUEST = 500

function asRecord(x: unknown): Record<string, unknown> | null {
  if (x && typeof x === 'object' && !Array.isArray(x)) return x as Record<string, unknown>
  return null
}

function cellStr(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v)
    } catch {
      return ''
    }
  }
  return String(v).trim()
}

/** Ưu tiên chuỗi/số; object (vd. stock_info Shopee) → JSON snippet thay vì "[object Object]". */
function coalesceTextField(...vals: unknown[]): string {
  for (const v of vals) {
    if (v == null) continue
    if (typeof v === 'string') {
      const t = v.trim()
      if (t) return t
      continue
    }
    if (typeof v === 'number' && Number.isFinite(v)) return String(v)
    if (typeof v === 'boolean') return v ? 'true' : 'false'
    if (typeof v === 'object') {
      try {
        const s = JSON.stringify(v)
        if (s && s !== '{}') return s
      } catch {
        /* ignore */
      }
    }
  }
  return ''
}

function normalizeComparableText(s: string): string {
  return s.trim().toLowerCase()
}

function looksLikePriceText(s: string): boolean {
  const t = normalizeComparableText(s)
  if (!t) return false
  if (/[₫$€¥£]|vnd|vnđ|k\b|đ\b|usd|eur|jpy|cny|krw|thb|rs\b/.test(t)) return true
  const digits = (t.match(/\d/g) ?? []).length
  if (digits >= 3 && /[0-9][\d\s.,]{2,}/.test(t)) return true
  return false
}

function looksLikeStockStatusText(s: string): boolean {
  const t = normalizeComparableText(s)
  if (!t) return false
  return /(còn|con|hết|het|size|cỡ|co san|co hang|in stock|out of stock|available|sold out|pre-?order)/.test(t)
}

function invalidPriceStructureMessage(itemName: string): string {
  const n = itemName.trim() || '(unknown item)'
  return `INVALID_PRICE_STRUCTURE for "${n}": price_hint/price looks like stock-status text. Put availability in stock_note and actual price in price_hint.`
}

/** Trạng thái listing kiểu sàn — map sang is_active. */
function itemStatusToActive(raw: unknown): boolean {
  const s = cellStr(raw).toUpperCase().replace(/\s+/g, '_')
  if (!s || s === 'NORMAL' || s === 'ACTIVE' || s === 'LISTED') return true
  if (
    s === 'UNLIST' ||
    s === 'UNLISTED' ||
    s === 'DELETED' ||
    s === 'DELETE' ||
    s === 'INACTIVE' ||
    s === 'BAN' ||
    s === 'BANNED'
  ) {
    return false
  }
  return true
}

function firstImageUrlFromItem(o: Record<string, unknown>): string {
  const direct = validateInventoryImageUrl(cellStr(o.image_url))
  if (direct) return direct

  const listTop = o.image_url_list
  if (Array.isArray(listTop)) {
    for (const u of listTop) {
      const v = validateInventoryImageUrl(cellStr(u))
      if (v) return v
    }
  }

  const img = asRecord(o.image)
  if (img) {
    const nested = img.image_url_list
    if (Array.isArray(nested)) {
      for (const u of nested) {
        const v = validateInventoryImageUrl(cellStr(u))
        if (v) return v
      }
    }
    const single = validateInventoryImageUrl(cellStr(img.image_url))
    if (single) return single
  }

  return ''
}

/**
 * Parse một phần tử `items[]` thành dòng kho nội bộ.
 * Chấp nhận alias: item_sku / sku, item_name / name, item_url / product_url, …
 */
export function openCatalogItemToInsert(obj: unknown): InventoryExcelInsert | null {
  const o = asRecord(obj)
  if (!o) return null

  const skuRaw = cellStr(o.item_sku ?? o.sku ?? o.model_sku ?? o.item_code).trim()
  const sku = skuRaw ? skuRaw.slice(0, 120) : null

  const name = cellStr(o.item_name ?? o.name ?? o.product_name).trim()
  if (!name) return null

  const sortRaw = cellStr(o.sort_order ?? o.sort ?? o.display_order)
  let sort_order = parseInt(sortRaw, 10)
  if (!Number.isFinite(sort_order)) sort_order = 100

  const description = coalesceTextField(o.description, o.desc, o.item_description).slice(0, 4000)
  const rawStockNote = coalesceTextField(
    o.stock_note,
    o.stock,
    o.seller_stock,
    o.stock_info
  )
  const rawPriceHint = coalesceTextField(
    o.price_hint,
    o.price,
    o.original_price,
    o.price_info
  )
  let stock_note = rawStockNote
  let price_hint = rawPriceHint

  if (price_hint && !looksLikePriceText(price_hint) && looksLikeStockStatusText(price_hint)) {
    throw new Error(invalidPriceStructureMessage(name))
  }

  // Fallback: if only stock field looks like a valid price, recover it as price_hint.
  if (!price_hint && stock_note && looksLikePriceText(stock_note) && !looksLikeStockStatusText(stock_note)) {
    price_hint = stock_note
    stock_note = ''
  }

  stock_note = stock_note.slice(0, 2000)
  price_hint = price_hint.slice(0, 500)

  const image_url = firstImageUrlFromItem(o)
  const product_url = validateInventoryProductUrl(
    cellStr(o.item_url ?? o.product_url ?? o.url ?? o.shop_url)
  )

  const consult_note = coalesceTextField(o.consult_note, o.seller_note, o.note).slice(0, 2000)
  const is_active = itemStatusToActive(o.item_status ?? o.status)

  return {
    sort_order,
    name: name.slice(0, 500),
    sku,
    description,
    stock_note,
    price_hint,
    image_url,
    product_url,
    consult_note,
    is_active,
    removeFromInventory: false,
  }
}

export type OpenCatalogParseResult =
  | { ok: true; request_id: string | null; rows: InventoryExcelInsert[] }
  | { ok: false; error: string; code: string }

/**
 * Body chuẩn:
 * ```json
 * {
 *   "request_id": "optional-string",
 *   "items": [ { "item_sku": "…", "item_name": "…", "item_status": "NORMAL", "image": { "image_url_list": ["https://…"] } } ]
 * }
 * ```
 */
export function parseOpenCatalogBody(json: unknown): OpenCatalogParseResult {
  const root = asRecord(json)
  if (!root) return { ok: false, error: 'Body must be a JSON object.', code: 'INVALID_JSON_ROOT' }

  const request_id = cellStr(root.request_id) || null
  const items = root.items
  if (!Array.isArray(items)) {
    return { ok: false, error: 'Missing or invalid "items" array.', code: 'MISSING_ITEMS' }
  }
  if (items.length === 0) {
    return { ok: false, error: 'Empty "items" array.', code: 'EMPTY_ITEMS' }
  }
  if (items.length > MAX_OPEN_CATALOG_ITEMS_PER_REQUEST) {
    return {
      ok: false,
      error: `Too many items (max ${MAX_OPEN_CATALOG_ITEMS_PER_REQUEST} per request).`,
      code: 'TOO_MANY_ITEMS',
    }
  }

  const rows: InventoryExcelInsert[] = []
  for (let i = 0; i < items.length; i++) {
    let row: InventoryExcelInsert | null = null
    try {
      row = openCatalogItemToInsert(items[i])
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid item.'
      return { ok: false, error: msg, code: 'INVALID_PRICE_STRUCTURE' }
    }
    if (!row) {
      return {
        ok: false,
        error: `Invalid item at index ${i}: need item_name (or name) and non-empty title.`,
        code: 'INVALID_ITEM',
      }
    }
    rows.push(row)
  }

  return { ok: true, request_id, rows }
}

type InventoryRow = Database['public']['Tables']['messaging_partner_inventory']['Row']

/**
 * Full reconcile cho Open Catalog:
 * - Payload backend shop là "nguồn sự thật".
 * - Hàng có trong DB nhưng không còn trong payload => thêm dòng removeFromInventory=true để xóa.
 */
export function buildOpenCatalogReconcileRows(
  incomingRows: InventoryExcelInsert[],
  existingRows: InventoryRow[]
): InventoryExcelInsert[] {
  const out: InventoryExcelInsert[] = [...incomingRows]

  const incomingSkuKeys = new Set<string>()
  const incomingNameNoSkuKeys = new Set<string>()
  for (const row of incomingRows) {
    const sk = inventorySkuMatchKey(row.sku)
    if (sk) incomingSkuKeys.add(sk)
    else incomingNameNoSkuKeys.add(inventoryNameMatchKey(row.name))
  }

  for (const row of existingRows) {
    const sk = inventorySkuMatchKey(row.sku)
    if (sk) {
      if (incomingSkuKeys.has(sk)) continue
      out.push({
        sort_order: row.sort_order,
        name: row.name,
        sku: row.sku,
        description: row.description ?? '',
        stock_note: row.stock_note ?? '',
        price_hint: row.price_hint ?? '',
        image_url: row.image_url ?? '',
        product_url: row.product_url ?? '',
        consult_note: row.consult_note ?? '',
        is_active: row.is_active,
        removeFromInventory: true,
      })
      continue
    }

    const nk = inventoryNameMatchKey(row.name)
    if (incomingNameNoSkuKeys.has(nk)) continue
    out.push({
      sort_order: row.sort_order,
      name: row.name,
      sku: row.sku,
      description: row.description ?? '',
      stock_note: row.stock_note ?? '',
      price_hint: row.price_hint ?? '',
      image_url: row.image_url ?? '',
      product_url: row.product_url ?? '',
      consult_note: row.consult_note ?? '',
      is_active: row.is_active,
      removeFromInventory: true,
    })
  }

  return out
}
