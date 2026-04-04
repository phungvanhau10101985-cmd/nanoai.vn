/**
 * Cổng «Open Catalog» — body JSON theo quy ước gần marketplace (Shopee-style field names),
 * để bất kỳ backend shop nào cũng có thể đẩy sản phẩm vào kho NanoAI (`messaging_partner_inventory`).
 *
 * Không phải proxy Shopee; đây là **chuẩn NanoAI** lấy cảm hứng từ tên trường phổ biến (item_sku, item_name, item_status, image_url_list).
 */

import type { InventoryExcelInsert } from '@/lib/messaging/partner-inventory-excel'
import {
  validateInventoryImageUrl,
  validateInventoryProductUrl,
} from '@/lib/messaging/partner-inventory-excel'

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
  const stock_note = coalesceTextField(
    o.stock_note,
    o.stock,
    o.seller_stock,
    o.stock_info
  ).slice(0, 2000)
  const price_hint = coalesceTextField(
    o.price_hint,
    o.price,
    o.original_price,
    o.price_info
  ).slice(0, 500)

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
    const row = openCatalogItemToInsert(items[i])
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
