/**
 * Đồng bộ kho từ REST danh sách SP khách (GET products_list_url) + bảng map trường.
 * Snapshot chỉ theo Remarketing/content ID: thêm mã mới, xóa mã hết trong feed, không cập nhật nội dung khi mã đã tồn tại.
 */

import { validateInventoryHttpUrl } from '@/lib/messaging/inventory-http-url'
import type { InventoryExcelInsert, InventoryRow } from '@/lib/messaging/partner-inventory-excel'
import {
  inventoryRemarketingMatchKey,
  validateInventoryImageUrl,
  validateInventoryProductUrl,
} from '@/lib/messaging/partner-inventory-excel'
import type { InventoryExternalSyncMapKey } from '@/lib/messaging/partner-inventory-external-sync-defaults'
import {
  fetchMessagingPartnerOwnerUserIdFromPg,
  fetchMessagingPartnersByIdsFromPg,
} from '@/lib/db/messaging-partners-pg'
import {
  fetchPartnerInventoryExternalSyncSettingsFromPg,
  updatePartnerExternalCatalogSyncMetaFromPg,
} from '@/lib/db/messaging-partner-inventory-external-sync-pg'
import { DEFAULT_WEB_LOCALE, type WebLocale } from '@/lib/i18n/config'
import {
  notifyPartnerExternalCatalogSyncReport,
  type ExternalCatalogSyncReportStats,
} from '@/lib/messaging/partner-inventory-external-catalog-sync-notify'
import {
  listPartnerInventoryRows,
  upsertPartnerInventoryRemarketingIncrementalBatch,
} from '@/lib/messaging/partner-inventory-upsert-batch'

/**
 * Snapshot GET kho khách: khóa là remarketing_id (sau trim).
 * - Mã đã có trong kho → không tạo dòng (không cập nhật nội dung).
 * - Mã mới → insert payload hiện tại.
 * - Mã có trong kho mà không còn trong feed → removeFromInventory cho tất cả dòng mang mã đó.
 * Dòng kho không có remarketing_id không bị xóa bởi snapshot; sản phẩm feed không map được mã không vào snapshot.
 */
export function buildExternalCatalogRemarketingSnapshotRows(
  incomingRows: InventoryExcelInsert[],
  existingRows: InventoryRow[]
): InventoryExcelInsert[] {
  const byRemarketing = new Map<string, InventoryRow[]>()
  for (const row of existingRows) {
    const k = inventoryRemarketingMatchKey(row.remarketing_id)
    if (!k) continue
    const arr = byRemarketing.get(k) ?? []
    arr.push(row)
    byRemarketing.set(k, arr)
  }

  const seenIncoming = new Map<string, InventoryExcelInsert>()
  for (const row of incomingRows) {
    const k = inventoryRemarketingMatchKey(row.remarketing_id)
    if (!k) continue
    if (!seenIncoming.has(k)) seenIncoming.set(k, row)
  }
  const incomingKeys = new Set(seenIncoming.keys())

  const out: InventoryExcelInsert[] = []
  for (const row of seenIncoming.values()) {
    const k = inventoryRemarketingMatchKey(row.remarketing_id)!
    if (byRemarketing.has(k)) continue
    out.push({ ...row, removeFromInventory: false })
  }

  for (const [k, list] of byRemarketing) {
    if (!incomingKeys.has(k)) {
      const sample = list[0]
      out.push({
        sort_order: sample.sort_order,
        name: sample.name,
        sku: sample.sku,
        description: sample.description ?? '',
        stock_note: sample.stock_note ?? '',
        stock_qty: Math.max(0, Number(sample.stock_qty ?? 0)),
        price_hint: sample.price_hint ?? '',
        image_url: sample.image_url ?? '',
        product_url: sample.product_url ?? '',
        product_video_url: sample.product_video_url ?? '',
        consult_note: sample.consult_note ?? '',
        remarketing_id: k,
        is_active: sample.is_active,
        removeFromInventory: true,
      })
    }
  }

  return out
}
function countDistinctRemarketingIds(rows: InventoryExcelInsert[]): number {
  const s = new Set<string>()
  for (const r of rows) {
    const k = inventoryRemarketingMatchKey(r.remarketing_id)
    if (k) s.add(k)
  }
  return s.size
}

const FETCH_TIMEOUT_MS = Math.max(
  10_000,
  Math.min(120_000, parseInt(process.env.EXTERNAL_CATALOG_FETCH_TIMEOUT_MS || '45000', 10) || 45_000)
)
/** 188 giới hạn cứng 1000 SP/trang — mặc định dùng luôn mức tối đa để giảm số trang cần gọi. */
const PAGE_LIMIT = Math.min(
  1000,
  Math.max(50, parseInt(process.env.EXTERNAL_CATALOG_PAGE_LIMIT || '1000', 10) || 1000)
)
const MAX_PRODUCTS = Math.min(
  200_000,
  Math.max(1_000, parseInt(process.env.EXTERNAL_CATALOG_MAX_PRODUCTS || '50000', 10) || 50_000)
)
/** Số trang gọi song song — giúp job ~100 trang (100k SP) chạy trong vài phút thay vì tuần tự ~50 phút. */
const FETCH_CONCURRENCY = Math.max(
  1,
  Math.min(8, parseInt(process.env.EXTERNAL_CATALOG_FETCH_CONCURRENCY || '4', 10) || 4)
)
/** API incremental của 188 quy định `limit=500`. */
const INCREMENTAL_PAGE_LIMIT = 500
/**
 * Ngưỡng an toàn cho toàn bộ vòng lặp tải trang — phải nhỏ hơn `maxDuration` của route gọi hàm này
 * (hiện route cron/manual set 600s) để job tự dừng gọn (trả FETCH_TIMEOUT) thay vì bị nền tảng
 * (Vercel) cắt giữa chừng. Không cấu hình vượt quá thời lượng route cho phép.
 */
const JOB_TIMEOUT_MS = Math.max(
  60_000,
  Math.min(3_500_000, parseInt(process.env.EXTERNAL_CATALOG_JOB_TIMEOUT_MS || '540000', 10) || 540_000)
)

function cellStr(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v === 'string') return v.trim()
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

/** Tránh SSRF cơ bản: chỉ HTTPS, không localhost / RFC1918. */
export function assertPublicHttpsCatalogListUrl(urlStr: string): URL | null {
  let u: URL
  try {
    u = new URL(urlStr.trim())
  } catch {
    return null
  }
  if (u.protocol !== 'https:') return null
  const host = u.hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost')) return null
  if (/^127\./.test(host) || host === '0.0.0.0') return null
  if (/^10\./.test(host)) return null
  if (/^192\.168\./.test(host)) return null
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return null
  return u
}

function getValueByPath(obj: unknown, path: string): unknown {
  const p = path.trim()
  if (!p || obj == null) return undefined
  const parts = p.split('.').filter(Boolean)
  let cur: unknown = obj
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return cur
}

function formatStockPiece(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v.trim()
  if (Array.isArray(v) || typeof v === 'object') {
    try {
      return JSON.stringify(v)
    } catch {
      return ''
    }
  }
  return String(v)
}

function mapProductToInventoryRow(
  product: unknown,
  fieldMapping: Record<string, string>
): InventoryExcelInsert | null {
  if (!product || typeof product !== 'object' || Array.isArray(product)) return null
  const p = product as Record<string, unknown>
  const get = (key: InventoryExternalSyncMapKey): unknown => {
    const path = fieldMapping[key]?.trim()
    if (!path) return undefined
    return getValueByPath(p, path)
  }
  /** Giữ tương thích API 188 cũ (`code`, `product_id`, `available`) và contract incremental mới (`sku`, `id`, `stock`). */
  const getWithFallback = (key: InventoryExternalSyncMapKey, fallbackKeys: string[]): unknown => {
    const mapped = get(key)
    if (mapped != null && mapped !== '') return mapped
    for (const fallbackKey of fallbackKeys) {
      const value = p[fallbackKey]
      if (value != null && value !== '') return value
    }
    return mapped
  }

  const name = cellStr(getWithFallback('name', ['name']))
  if (!name) return null

  const skuRaw = cellStr(getWithFallback('sku', ['code', 'sku'])).slice(0, 120)
  const sku = skuRaw || null

  const description = cellStr(get('description')).slice(0, 4000)

  const priceRaw = getWithFallback('price', ['price'])
  let price_hint = ''
  if (typeof priceRaw === 'number' && Number.isFinite(priceRaw)) {
    price_hint = `${Math.round(priceRaw).toLocaleString('vi-VN')}đ`
  } else {
    price_hint = cellStr(priceRaw).slice(0, 500)
  }

  let stock_qty = 0
  const qtyRaw = getWithFallback('stock_qty', ['available', 'stock', 'stock_qty'])
  if (typeof qtyRaw === 'number' && Number.isFinite(qtyRaw)) {
    stock_qty = Math.max(0, Math.floor(qtyRaw))
  } else {
    stock_qty = Math.max(0, parseInt(cellStr(qtyRaw).replace(/[^\d-]/g, ''), 10) || 0)
  }

  /** Cột `stock_note` (NanoAI) lưu JSON màu [{name,img}] cho bộ chọn màu trên shop — chỉ lấy từ `colors_json`. */
  const cj = get('colors_json')
  const stock_note = (cj != null ? formatStockPiece(cj) : '').slice(0, 2000)

  const image_url = validateInventoryImageUrl(cellStr(get('image')))
  const product_url = validateInventoryProductUrl(cellStr(get('slug')))
  const product_video_url = validateInventoryHttpUrl(cellStr(get('video'))).slice(0, 2000)

  let consult_note = ''
  const cRaw = get('consult_note')
  if (cRaw != null && cRaw !== '') {
    if (typeof cRaw === 'object') {
      try {
        consult_note = JSON.stringify(cRaw)
      } catch {
        consult_note = cellStr(cRaw)
      }
    } else {
      consult_note = cellStr(cRaw)
    }
    consult_note = consult_note.slice(0, 2000)
  }

  const remarketing_id = cellStr(getWithFallback('remarketing_id', ['product_id', 'id'])).slice(0, 500)

  let sort_order = 100
  const so = get('sort_order')
  if (typeof so === 'number' && Number.isFinite(so)) sort_order = Math.floor(so)
  else {
    const n = parseInt(cellStr(so), 10)
    if (Number.isFinite(n)) sort_order = n
  }

  let is_active = true
  const ia = get('is_active')
  if (typeof ia === 'boolean') is_active = ia
  else if (cellStr(ia).toLowerCase() === 'false' || cellStr(ia) === '0') is_active = false

  return {
    sort_order,
    name: name.slice(0, 500),
    sku,
    description,
    stock_note,
    stock_qty,
    price_hint,
    image_url,
    product_url,
    product_video_url,
    consult_note,
    remarketing_id,
    is_active,
    removeFromInventory: false,
  }
}

function productIsSoftDeleted(product: unknown): boolean {
  if (!product || typeof product !== 'object' || Array.isArray(product)) return false
  const value = (product as Record<string, unknown>).is_deleted
  return value === true || value === 1 || String(value ?? '').trim().toLowerCase() === 'true'
}

function productRemarketingId(product: unknown, fieldMapping: Record<string, string>): string {
  if (!product || typeof product !== 'object' || Array.isArray(product)) return ''
  const path = fieldMapping.remarketing_id?.trim()
  const mapped = path ? getValueByPath(product, path) : undefined
  if (mapped != null && mapped !== '') return cellStr(mapped).slice(0, 500)
  const raw = product as Record<string, unknown>
  return cellStr(raw.product_id ?? raw.id).slice(0, 500)
}

function incrementalCatalogEndpoint(listUrl: string): URL | null {
  const base = assertPublicHttpsCatalogListUrl(listUrl)
  if (!base) return null
  /** Chuyển cấu hình 188 cũ sang endpoint incremental mới, không ảnh hưởng URL API của shop khác. */
  if (base.hostname.toLowerCase() === '188.com.vn' && base.pathname === '/api/v1/products/list/full') {
    base.pathname = '/api/v1/products'
    base.search = ''
  }
  return base
}

function lastSuccessfulSyncOrEpoch(timestamp: string | null | undefined): string {
  const parsed = Date.parse(String(timestamp ?? ''))
  return Number.isNaN(parsed) ? '1970-01-01T00:00:00Z' : new Date(parsed).toISOString()
}

async function fetchJson(url: URL, signal: AbortSignal): Promise<unknown> {
  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
    cache: 'no-store',
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`HTTP ${res.status}: ${t.slice(0, 500)}`)
  }
  return (await res.json()) as unknown
}

function extractProductsBatch(data: unknown): unknown[] | null {
  const root = data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : null
  if (!root) return null
  const batch = Array.isArray(root.products)
    ? root.products
    : Array.isArray(root.items)
      ? root.items
      : Array.isArray(root.data)
        ? root.data
        : null
  return batch
}

function extractTotal(data: unknown): number | null {
  const root = data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : null
  if (!root) return null
  const t = Number(root.total)
  return Number.isFinite(t) && t > 0 ? t : null
}

async function fetchOnePage(
  base: URL,
  skip: number,
  jobSignal: AbortSignal,
  extraParams?: Record<string, string>
): Promise<unknown> {
  const u = new URL(base.toString())
  u.searchParams.set('skip', String(skip))
  u.searchParams.set('limit', String(PAGE_LIMIT))
  if (!u.searchParams.has('is_active')) u.searchParams.set('is_active', 'true')
  if (extraParams) {
    for (const [k, v] of Object.entries(extraParams)) u.searchParams.set(k, v)
  }

  const pageAc = new AbortController()
  const pageTo = setTimeout(() => pageAc.abort(), FETCH_TIMEOUT_MS)
  const onJobAbort = () => pageAc.abort()
  jobSignal.addEventListener('abort', onJobAbort)
  try {
    return await fetchJson(u, pageAc.signal)
  } finally {
    clearTimeout(pageTo)
    jobSignal.removeEventListener('abort', onJobAbort)
  }
}

/**
 * Tải danh sách SP từ URL (định dạng kiểu 188: `products` + `total`, tham số skip/limit, tối đa
 * 1000 SP/trang). Trang đầu gọi riêng để biết `total`, các trang còn lại gọi song song theo lô
 * (`FETCH_CONCURRENCY`) để rút ngắn tổng thời gian job (~100 trang cho 100k SP).
 */
export async function fetchExternalCatalogProducts(
  listUrl: string
): Promise<
  | { ok: true; products: unknown[] }
  | {
      ok: false
      code: 'INVALID_LIST_URL' | 'NOT_JSON_OBJECT' | 'NO_PRODUCTS_ARRAY' | 'FETCH_TIMEOUT' | 'FETCH_FAILED'
      detail?: string
    }
> {
  const base = assertPublicHttpsCatalogListUrl(listUrl)
  if (!base) {
    return { ok: false, code: 'INVALID_LIST_URL' as const }
  }

  const ac = new AbortController()
  const to = setTimeout(() => ac.abort(), JOB_TIMEOUT_MS)

  try {
    // Trang đầu: đọc total + batch đầu tiên.
    const firstData = await fetchOnePage(base, 0, ac.signal)
    const firstBatch = extractProductsBatch(firstData)
    if (!firstBatch) return { ok: false, code: 'NO_PRODUCTS_ARRAY' as const }

    const products: unknown[] = [...firstBatch]
    const total = extractTotal(firstData) ?? (firstBatch.length < PAGE_LIMIT ? firstBatch.length : Number.POSITIVE_INFINITY)

    if (firstBatch.length > 0 && total > PAGE_LIMIT) {
      // Danh sách các skip còn lại cần tải, giới hạn theo MAX_PRODUCTS.
      const remainingSkips: number[] = []
      for (let skip = PAGE_LIMIT; skip < total && skip < MAX_PRODUCTS; skip += PAGE_LIMIT) {
        remainingSkips.push(skip)
      }

      let cursor = 0
      let stopEarly = false
      const results: unknown[][] = new Array(remainingSkips.length)
      const workers = Array.from({ length: Math.min(FETCH_CONCURRENCY, remainingSkips.length) }, async () => {
        while (!stopEarly) {
          const idx = cursor
          cursor += 1
          if (idx >= remainingSkips.length) return
          const data = await fetchOnePage(base, remainingSkips[idx], ac.signal)
          const batch = extractProductsBatch(data)
          if (!batch) {
            stopEarly = true
            throw new Error('NO_PRODUCTS_ARRAY')
          }
          results[idx] = batch
          if (batch.length === 0) stopEarly = true
        }
      })
      await Promise.all(workers)

      for (const batch of results) {
        if (!batch) continue
        for (const row of batch) {
          products.push(row)
          if (products.length >= MAX_PRODUCTS) break
        }
        if (products.length >= MAX_PRODUCTS) break
      }
    }

    return { ok: true, products: products.slice(0, MAX_PRODUCTS) }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg === 'NO_PRODUCTS_ARRAY') return { ok: false, code: 'NO_PRODUCTS_ARRAY' as const }
    if (msg.includes('abort')) return { ok: false, code: 'FETCH_TIMEOUT' as const }
    return { ok: false, code: 'FETCH_FAILED' as const, detail: msg.slice(0, 500) }
  } finally {
    clearTimeout(to)
  }
}

/**
 * Tải danh sách SP mới/thay đổi từ web khách bằng filter incremental do khách xác nhận hỗ trợ
 * theo hợp đồng 188: `updated_since`, `page`, `limit`, `data`, `pagination.total_pages`.
 */
export async function fetchExternalCatalogIncrementalProducts(
  listUrl: string,
  updatedSince: string
): Promise<
  | { ok: true; products: unknown[] }
  | {
      ok: false
      code: 'INVALID_LIST_URL' | 'NOT_JSON_OBJECT' | 'NO_PRODUCTS_ARRAY' | 'FETCH_TIMEOUT' | 'FETCH_FAILED'
      detail?: string
    }
> {
  const base = incrementalCatalogEndpoint(listUrl)
  if (!base) return { ok: false, code: 'INVALID_LIST_URL' as const }

  const ac = new AbortController()
  const to = setTimeout(() => ac.abort(), JOB_TIMEOUT_MS)

  try {
    const products: unknown[] = []
    let page = 1
    let totalPages = Number.POSITIVE_INFINITY
    while (page <= totalPages && products.length < MAX_PRODUCTS) {
      const u = new URL(base)
      u.searchParams.delete('is_active')
      u.searchParams.set('updated_since', updatedSince)
      u.searchParams.set('page', String(page))
      u.searchParams.set('limit', String(INCREMENTAL_PAGE_LIMIT))
      const data = await fetchJson(u, ac.signal)
      const root = data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : null
      const batch = root && Array.isArray(root.data) ? root.data : null
      if (!batch) return { ok: false, code: 'NO_PRODUCTS_ARRAY' as const }
      if (root?.success === false) {
        return { ok: false, code: 'FETCH_FAILED' as const, detail: 'Incremental API returned success=false.' }
      }
      const pagination = root?.pagination
      if (!pagination || typeof pagination !== 'object') {
        return {
          ok: false,
          code: 'FETCH_FAILED' as const,
          detail: 'Incremental API response must include pagination.total_pages.',
        }
      }
      const pages = Number((pagination as Record<string, unknown>).total_pages)
      if (Number.isInteger(pages) && pages >= 0) totalPages = pages
      else {
        return {
          ok: false,
          code: 'FETCH_FAILED' as const,
          detail: 'Incremental API pagination.total_pages must be a non-negative integer.',
        }
      }
      for (const row of batch) {
        products.push(row)
        if (products.length >= MAX_PRODUCTS) break
      }
      if (batch.length === 0) break
      page += 1
    }
    return { ok: true, products }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('abort')) return { ok: false, code: 'FETCH_TIMEOUT' as const }
    return { ok: false, code: 'FETCH_FAILED' as const, detail: msg.slice(0, 500) }
  } finally {
    clearTimeout(to)
  }
}

export type ExternalCatalogSyncErrorCode =
  | 'NO_PARTNER_ID'
  | 'MISSING_LIST_URL'
  | 'INVALID_LIST_URL'
  | 'NOT_JSON_OBJECT'
  | 'NO_PRODUCTS_ARRAY'
  | 'FETCH_TIMEOUT'
  | 'FETCH_FAILED'
  | 'NO_VALID_ROWS'
  | 'LIST_INVENTORY_FAILED'
  | 'UPSERT_FAILED'

export function formatExternalCatalogSyncErrorForStorage(code: ExternalCatalogSyncErrorCode, detail?: string): string {
  const d = detail?.trim().slice(0, 3900)
  return d ? `${code}\n${d}` : code
}

export type ExternalCatalogSyncOutcome =
  | {
      ok: true
      fetched: number
      inserted: number
      updated: number
      deleted: number
      embeddingsDeferred: boolean
    }
  | { ok: false; code: ExternalCatalogSyncErrorCode; detail?: string }

/**
 * Chạy một vòng đồng bộ đầy đủ (reconcile) cho một shop — dùng nút tay hoặc cron.
 * Luôn gửi báo cáo chi tiết tới chủ shop (thông báo + email + push) sau khi kết thúc.
 */
export async function runPartnerExternalCatalogSyncJob(params: {
  partnerId: string
  deferEmbeddings?: boolean
  reportLocale?: WebLocale
  reportSource?: 'manual' | 'cron'
}): Promise<ExternalCatalogSyncOutcome> {
  const partnerId = String(params.partnerId ?? '').trim()
  if (!partnerId) {
    return { ok: false, code: 'NO_PARTNER_ID' }
  }

  const reportLocale = params.reportLocale ?? DEFAULT_WEB_LOCALE
  const reportSource = params.reportSource ?? 'cron'
  const stats: ExternalCatalogSyncReportStats = {
    fetched: 0,
    mappedRows: 0,
    remarketingInFeed: 0,
    skippedEmptyApi: false,
  }

  const [ownerUserId, shopPack] = await Promise.all([
    fetchMessagingPartnerOwnerUserIdFromPg(partnerId),
    fetchMessagingPartnersByIdsFromPg([partnerId]),
  ])
  const shopLabel = shopPack?.[0]?.display_name?.trim() || partnerId

  const sendReport = async (outcome: ExternalCatalogSyncOutcome) => {
    if (!ownerUserId) return
    try {
      await notifyPartnerExternalCatalogSyncReport({
        userId: ownerUserId,
        partnerId,
        shopLabel,
        locale: reportLocale,
        source: reportSource,
        outcome,
        stats,
      })
    } catch (e) {
      console.warn('[runPartnerExternalCatalogSyncJob] notify', e)
    }
  }

  const settings = await fetchPartnerInventoryExternalSyncSettingsFromPg(partnerId)
  const listUrl = settings?.products_list_url?.trim() ?? ''
  if (!listUrl) {
    await updatePartnerExternalCatalogSyncMetaFromPg(partnerId, {
      error: formatExternalCatalogSyncErrorForStorage('MISSING_LIST_URL'),
    })
    const out: ExternalCatalogSyncOutcome = { ok: false, code: 'MISSING_LIST_URL' }
    await sendReport(out)
    return out
  }

  const fm = settings?.field_mapping ?? {}
  /** API 188 có thể trả lại item đúng mốc; UPSERT theo `product_id` vẫn idempotent, không tạo trùng. */
  const updatedSince = lastSuccessfulSyncOrEpoch(settings?.catalog_last_sync_at)
  const pulled = await fetchExternalCatalogIncrementalProducts(listUrl, updatedSince)
  if (!pulled.ok) {
    const persistCode = pulled.code as ExternalCatalogSyncErrorCode
    await updatePartnerExternalCatalogSyncMetaFromPg(partnerId, {
      error: formatExternalCatalogSyncErrorForStorage(persistCode, pulled.detail),
    })
    const out: ExternalCatalogSyncOutcome = {
      ok: false,
      code: persistCode,
      detail: pulled.detail,
    }
    await sendReport(out)
    return out
  }

  stats.fetched = pulled.products.length

  const rows: InventoryExcelInsert[] = []
  const deletedRemarketingIds: string[] = []
  for (const raw of pulled.products) {
    if (productIsSoftDeleted(raw)) {
      const remarketingId = productRemarketingId(raw, fm)
      if (remarketingId) deletedRemarketingIds.push(remarketingId)
      continue
    }
    const row = mapProductToInventoryRow(raw, fm)
    if (row) rows.push(row)
  }

  stats.mappedRows = rows.length
  stats.remarketingInFeed = countDistinctRemarketingIds(rows)

  if (pulled.products.length > 0 && rows.length === 0 && deletedRemarketingIds.length === 0) {
    await updatePartnerExternalCatalogSyncMetaFromPg(partnerId, {
      error: formatExternalCatalogSyncErrorForStorage('NO_VALID_ROWS'),
    })
    const out: ExternalCatalogSyncOutcome = { ok: false, code: 'NO_VALID_ROWS' }
    await sendReport(out)
    return out
  }

  /** Phản hồi rỗng (0 sản phẩm): không reconcile — giữ nguyên kho. */
  if (pulled.products.length === 0) {
    const deferEmbeddings = params.deferEmbeddings !== false
    stats.skippedEmptyApi = true
    stats.mappedRows = 0
    stats.remarketingInFeed = 0
    await updatePartnerExternalCatalogSyncMetaFromPg(partnerId, { success: true })
    const out: ExternalCatalogSyncOutcome = {
      ok: true,
      fetched: 0,
      inserted: 0,
      updated: 0,
      deleted: 0,
      embeddingsDeferred: deferEmbeddings,
    }
    await sendReport(out)
    return out
  }

  const listed = await listPartnerInventoryRows(partnerId)
  if (!listed.ok) {
    await updatePartnerExternalCatalogSyncMetaFromPg(partnerId, {
      error: formatExternalCatalogSyncErrorForStorage('LIST_INVENTORY_FAILED', listed.error),
    })
    const out: ExternalCatalogSyncOutcome = {
      ok: false,
      code: 'LIST_INVENTORY_FAILED',
      detail: listed.error,
    }
    await sendReport(out)
    return out
  }

  const deferEmbeddings = params.deferEmbeddings !== false
  const batch = await upsertPartnerInventoryRemarketingIncrementalBatch(partnerId, rows, {
    existingRows: listed.rows,
    deferEmbeddings,
    deleteRemarketingIds: deletedRemarketingIds,
  })
  if (!batch.ok) {
    await updatePartnerExternalCatalogSyncMetaFromPg(partnerId, {
      error: formatExternalCatalogSyncErrorForStorage('UPSERT_FAILED', batch.error),
    })
    const out: ExternalCatalogSyncOutcome = {
      ok: false,
      code: 'UPSERT_FAILED',
      detail: batch.error,
    }
    await sendReport(out)
    return out
  }

  await updatePartnerExternalCatalogSyncMetaFromPg(partnerId, { success: true })

  const out: ExternalCatalogSyncOutcome = {
    ok: true,
    fetched: pulled.products.length,
    inserted: batch.inserted,
    updated: batch.updated,
    deleted: batch.deleted,
    embeddingsDeferred: batch.embeddingsDeferred,
  }
  await sendReport(out)
  return out
}
