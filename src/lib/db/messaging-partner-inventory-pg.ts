import { createHash } from 'node:crypto'
import type { Database, Json } from '@/types/database.types'
import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { normalizeProductUrlKey } from '@/lib/messaging/normalize-product-url-key'
import { PARTNER_PUBLIC_INVENTORY_SEARCH_MAX } from '@/lib/messaging/partner-public-search-limits'
import { parseVndFromPriceHint } from '@/lib/partner-website/shop/cart-line-utils'

/**
 * W4.10 — giá dạng số tự tính từ `price_hint` mỗi lần ghi (tạo/sửa/import). Dòng cũ chưa
 * từng ghi lại giữ `price_amount = null` cho tới lần sửa kế tiếp — không backfill hàng loạt
 * để tránh đổi hành vi hiển thị giá hiện có (additive, xem docs/188_BEHAVIOR_SPEC.md mục A.4).
 */
function computePriceAmountForWrite(priceHint: string | null | undefined): number | null {
  const amount = parseVndFromPriceHint(priceHint ?? undefined)
  return amount > 0 ? amount : null
}

export type MessagingPartnerInventoryRow = Database['public']['Tables']['messaging_partner_inventory']['Row']
export type MessagingPartnerInventoryInsert = Database['public']['Tables']['messaging_partner_inventory']['Insert']

const INVENTORY_FULL_LIST_PAGE = 1000

function tsIso(v: unknown): string | null {
  if (v == null || v === '') return null
  if (v instanceof Date) return v.toISOString()
  const s = String(v)
  return s || null
}

function tsIsoReq(v: unknown): string {
  if (v instanceof Date) return v.toISOString()
  return String(v ?? '')
}

function num(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v)
  return fallback
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v)
  return null
}

function parseEmbeddingJson(v: unknown): number[] | null {
  if (v == null) return null
  if (!Array.isArray(v)) return null
  const out: number[] = []
  for (const x of v) {
    const n = Number(x)
    if (Number.isFinite(n)) out.push(n)
  }
  return out.length ? out : null
}

function isMissingInventoryTableError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const code = (e as { code?: unknown }).code
  if (code !== '42P01') return false
  const msg = String((e as { message?: unknown }).message ?? '')
  return /messaging_partner_inventory/i.test(msg)
}

function isMissingInventoryStockQtyColumnError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const err = e as { code?: string; message?: string }
  if (err.code !== '42703') return false
  const msg = String(err.message ?? '').toLowerCase()
  return msg.includes('stock_qty') && msg.includes('messaging_partner_inventory')
}

function isMissingRemarketingIdColumnError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const err = e as { code?: string; message?: string }
  if (err.code !== '42703') return false
  const msg = String(err.message ?? '').toLowerCase()
  return msg.includes('remarketing_id') && msg.includes('messaging_partner_inventory')
}

/** W4.10 — DB chưa áp migration `price_amount`/`price_currency`. */
function isMissingPriceAmountColumnError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const err = e as { code?: string; message?: string }
  if (err.code !== '42703') return false
  const msg = String(err.message ?? '').toLowerCase()
  return msg.includes('price_amount') && msg.includes('messaging_partner_inventory')
}

/** PS.1 — DB chưa áp migration Product Studio (colors_json/sizes_json/gallery_urls/...). */
function isMissingProductStudioColumnError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const err = e as { code?: string; message?: string }
  if (err.code !== '42703') return false
  const msg = String(err.message ?? '').toLowerCase()
  return (
    msg.includes('messaging_partner_inventory') &&
    (msg.includes('colors_json') ||
      msg.includes('sizes_json') ||
      msg.includes('gallery_urls') ||
      msg.includes('detail_image_urls') ||
      msg.includes('product_studio_meta') ||
      msg.includes('origin') ||
      msg.includes('product_studio_job_id'))
  )
}

type PgInventoryRaw = {
  id: string
  partner_id: string
  sort_order: number | null
  sku: string | null
  name: string
  description: string
  stock_note: string
  stock_qty: number | null
  price_hint: string
  image_url: string
  product_url: string
  product_video_url: string
  consult_note: string
  remarketing_id: string
  material_note: string
  material_detail_image_url: string
  real_use_image_url: string
  real_use_image_url_2: string
  is_active: boolean | null
  price_amount: number | string | null
  price_currency: string
  sale_price_amount: number | string | null
  sale_starts_at: unknown
  sale_ends_at: unknown
  image_embedding_json: unknown
  image_embedding_vec: string | null
  image_embedding_model: string | null
  image_embedding_dims: number | null
  image_embedding_fingerprint: string | null
  image_embedding_updated_at: unknown
  image_embedding_error: string | null
  text_embedding_json: unknown
  text_embedding_vec: string | null
  text_embedding_model: string | null
  text_embedding_dims: number | null
  text_embedding_fingerprint: string | null
  text_embedding_updated_at: unknown
  text_embedding_error: string | null
  vision_catalog_checksum: string | null
  vision_catalog_synced_at: unknown
  vision_catalog_excluded: boolean | null
  consult_link_opening_text: string | null
  consult_link_opening_input_fingerprint: string | null
  colors_json?: unknown
  sizes_json?: unknown
  gallery_urls?: unknown
  detail_image_urls?: unknown
  product_studio_meta?: unknown
  origin?: string | null
  product_studio_job_id?: string | null
  created_at: unknown
  updated_at: unknown
}

/** PS.1 — jsonb đã được node-postgres parse thành array/object JS sẵn; chỉ cần validate hình dạng. */
function parseJsonArrayColumn(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string' && raw.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

function parseColorsJsonColumn(raw: unknown): { name: string; img: string }[] | null {
  const arr = parseJsonArrayColumn(raw)
  if (!arr.length) return null
  const out: { name: string; img: string }[] = []
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const name = typeof o.name === 'string' ? o.name.trim() : ''
    const img = typeof o.img === 'string' ? o.img.trim() : ''
    if (name && img) out.push({ name, img })
  }
  return out.length ? out : null
}

function parseSizesJsonColumn(raw: unknown): string[] | null {
  const arr = parseJsonArrayColumn(raw)
  if (!arr.length) return null
  const out = arr.map((x) => String(x ?? '').trim()).filter(Boolean)
  return out.length ? out : null
}

function parseStringArrayColumn(raw: unknown): string[] {
  return parseJsonArrayColumn(raw)
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)
}

function mapPgInventoryRow(r: PgInventoryRaw): MessagingPartnerInventoryRow {
  return {
    id: r.id,
    partner_id: r.partner_id,
    sort_order: num(r.sort_order, 0),
    sku: r.sku ?? null,
    name: String(r.name ?? ''),
    description: String(r.description ?? ''),
    stock_note: String(r.stock_note ?? ''),
    stock_qty: num(r.stock_qty, 0),
    price_hint: String(r.price_hint ?? ''),
    image_url: String(r.image_url ?? ''),
    product_url: String(r.product_url ?? ''),
    product_video_url: String(r.product_video_url ?? ''),
    consult_note: String(r.consult_note ?? ''),
    remarketing_id: String(r.remarketing_id ?? ''),
    material_note: String(r.material_note ?? ''),
    material_detail_image_url: String(r.material_detail_image_url ?? ''),
    real_use_image_url: String(r.real_use_image_url ?? ''),
    real_use_image_url_2: String(r.real_use_image_url_2 ?? ''),
    is_active: r.is_active !== false,
    price_amount: numOrNull(r.price_amount),
    price_currency: String(r.price_currency ?? 'VND').trim() || 'VND',
    sale_price_amount: numOrNull(r.sale_price_amount),
    sale_starts_at: tsIso(r.sale_starts_at),
    sale_ends_at: tsIso(r.sale_ends_at),
    image_embedding_json: parseEmbeddingJson(r.image_embedding_json),
    image_embedding_vec: r.image_embedding_vec ?? null,
    image_embedding_model: r.image_embedding_model ?? null,
    image_embedding_dims: numOrNull(r.image_embedding_dims),
    image_embedding_fingerprint: r.image_embedding_fingerprint ?? null,
    image_embedding_updated_at: tsIso(r.image_embedding_updated_at),
    image_embedding_error: r.image_embedding_error ?? null,
    text_embedding_json: parseEmbeddingJson(r.text_embedding_json),
    text_embedding_vec: r.text_embedding_vec ?? null,
    text_embedding_model: r.text_embedding_model ?? null,
    text_embedding_dims: numOrNull(r.text_embedding_dims),
    text_embedding_fingerprint: r.text_embedding_fingerprint ?? null,
    text_embedding_updated_at: tsIso(r.text_embedding_updated_at),
    text_embedding_error: r.text_embedding_error ?? null,
    vision_catalog_checksum: r.vision_catalog_checksum ?? null,
    vision_catalog_synced_at: tsIso(r.vision_catalog_synced_at),
    vision_catalog_excluded: r.vision_catalog_excluded !== false,
    consult_link_opening_text: r.consult_link_opening_text != null ? String(r.consult_link_opening_text) : null,
    consult_link_opening_input_fingerprint: r.consult_link_opening_input_fingerprint ?? null,
    colors_json: parseColorsJsonColumn(r.colors_json),
    sizes_json: parseSizesJsonColumn(r.sizes_json),
    gallery_urls: parseStringArrayColumn(r.gallery_urls),
    detail_image_urls: parseStringArrayColumn(r.detail_image_urls),
    product_studio_meta:
      r.product_studio_meta && typeof r.product_studio_meta === 'object' ? (r.product_studio_meta as Json) : null,
    origin: r.origin ?? null,
    product_studio_job_id: r.product_studio_job_id ?? null,
    created_at: tsIsoReq(r.created_at),
    updated_at: tsIsoReq(r.updated_at),
  }
}

/** PS.1 — tầng cao nhất, gồm cột Product Studio. Fallback xuống `INVENTORY_PAGE_SELECT_PRE_PRODUCT_STUDIO` nếu DB chưa migration. */
const INVENTORY_PAGE_SELECT_WITH_PRODUCT_STUDIO = `select
  mpi.id::text as id,
  mpi.partner_id::text as partner_id,
  mpi.sort_order,
  mpi.sku,
  coalesce(mpi.name, '') as name,
  coalesce(mpi.description, '') as description,
  coalesce(mpi.stock_note, '') as stock_note,
  coalesce(mpi.stock_qty, 0) as stock_qty,
  coalesce(mpi.price_hint, '') as price_hint,
  coalesce(mpi.image_url, '') as image_url,
  coalesce(mpi.product_url, '') as product_url,
  coalesce(mpi.product_video_url, '') as product_video_url,
  coalesce(mpi.consult_note, '') as consult_note,
  coalesce(mpi.remarketing_id, '') as remarketing_id,
  coalesce(mpi.material_note, '') as material_note,
  coalesce(mpi.material_detail_image_url, '') as material_detail_image_url,
  coalesce(mpi.real_use_image_url, '') as real_use_image_url,
  coalesce(mpi.real_use_image_url_2, '') as real_use_image_url_2,
  coalesce(mpi.is_active, true) as is_active,
  mpi.price_amount,
  coalesce(mpi.price_currency, 'VND') as price_currency,
  mpi.sale_price_amount,
  mpi.sale_starts_at,
  mpi.sale_ends_at,
  mpi.image_embedding_json,
  mpi.image_embedding_vec::text as image_embedding_vec,
  mpi.image_embedding_model,
  mpi.image_embedding_dims,
  mpi.image_embedding_fingerprint,
  mpi.image_embedding_updated_at,
  mpi.image_embedding_error,
  mpi.text_embedding_json,
  mpi.text_embedding_vec::text as text_embedding_vec,
  mpi.text_embedding_model,
  mpi.text_embedding_dims,
  mpi.text_embedding_fingerprint,
  mpi.text_embedding_updated_at,
  mpi.text_embedding_error,
  mpi.vision_catalog_checksum,
  mpi.vision_catalog_synced_at,
  coalesce(mpi.vision_catalog_excluded, false) as vision_catalog_excluded,
  mpi.consult_link_opening_text,
  mpi.consult_link_opening_input_fingerprint,
  mpi.colors_json,
  mpi.sizes_json,
  mpi.gallery_urls,
  mpi.detail_image_urls,
  mpi.product_studio_meta,
  mpi.origin,
  mpi.product_studio_job_id::text as product_studio_job_id,
  mpi.created_at,
  mpi.updated_at
from public.messaging_partner_inventory mpi`

const INVENTORY_PAGE_SELECT = `select
  mpi.id::text as id,
  mpi.partner_id::text as partner_id,
  mpi.sort_order,
  mpi.sku,
  coalesce(mpi.name, '') as name,
  coalesce(mpi.description, '') as description,
  coalesce(mpi.stock_note, '') as stock_note,
  coalesce(mpi.stock_qty, 0) as stock_qty,
  coalesce(mpi.price_hint, '') as price_hint,
  coalesce(mpi.image_url, '') as image_url,
  coalesce(mpi.product_url, '') as product_url,
  coalesce(mpi.product_video_url, '') as product_video_url,
  coalesce(mpi.consult_note, '') as consult_note,
  coalesce(mpi.remarketing_id, '') as remarketing_id,
  coalesce(mpi.material_note, '') as material_note,
  coalesce(mpi.material_detail_image_url, '') as material_detail_image_url,
  coalesce(mpi.real_use_image_url, '') as real_use_image_url,
  coalesce(mpi.real_use_image_url_2, '') as real_use_image_url_2,
  coalesce(mpi.is_active, true) as is_active,
  mpi.price_amount,
  coalesce(mpi.price_currency, 'VND') as price_currency,
  mpi.sale_price_amount,
  mpi.sale_starts_at,
  mpi.sale_ends_at,
  mpi.image_embedding_json,
  mpi.image_embedding_vec::text as image_embedding_vec,
  mpi.image_embedding_model,
  mpi.image_embedding_dims,
  mpi.image_embedding_fingerprint,
  mpi.image_embedding_updated_at,
  mpi.image_embedding_error,
  mpi.text_embedding_json,
  mpi.text_embedding_vec::text as text_embedding_vec,
  mpi.text_embedding_model,
  mpi.text_embedding_dims,
  mpi.text_embedding_fingerprint,
  mpi.text_embedding_updated_at,
  mpi.text_embedding_error,
  mpi.vision_catalog_checksum,
  mpi.vision_catalog_synced_at,
  coalesce(mpi.vision_catalog_excluded, false) as vision_catalog_excluded,
  mpi.consult_link_opening_text,
  mpi.consult_link_opening_input_fingerprint,
  mpi.created_at,
  mpi.updated_at
from public.messaging_partner_inventory mpi`

/** DB chưa migration `price_amount`/`price_currency` (W4.10) — giữ đủ cột khác. */
const INVENTORY_PAGE_SELECT_PRE_PRICE_AMOUNT = `select
  mpi.id::text as id,
  mpi.partner_id::text as partner_id,
  mpi.sort_order,
  mpi.sku,
  coalesce(mpi.name, '') as name,
  coalesce(mpi.description, '') as description,
  coalesce(mpi.stock_note, '') as stock_note,
  coalesce(mpi.stock_qty, 0) as stock_qty,
  coalesce(mpi.price_hint, '') as price_hint,
  coalesce(mpi.image_url, '') as image_url,
  coalesce(mpi.product_url, '') as product_url,
  coalesce(mpi.product_video_url, '') as product_video_url,
  coalesce(mpi.consult_note, '') as consult_note,
  coalesce(mpi.remarketing_id, '') as remarketing_id,
  coalesce(mpi.material_note, '') as material_note,
  coalesce(mpi.material_detail_image_url, '') as material_detail_image_url,
  coalesce(mpi.real_use_image_url, '') as real_use_image_url,
  coalesce(mpi.real_use_image_url_2, '') as real_use_image_url_2,
  coalesce(mpi.is_active, true) as is_active,
  null::numeric as price_amount,
  'VND'::text as price_currency,
  mpi.image_embedding_json,
  mpi.image_embedding_vec::text as image_embedding_vec,
  mpi.image_embedding_model,
  mpi.image_embedding_dims,
  mpi.image_embedding_fingerprint,
  mpi.image_embedding_updated_at,
  mpi.image_embedding_error,
  mpi.text_embedding_json,
  mpi.text_embedding_vec::text as text_embedding_vec,
  mpi.text_embedding_model,
  mpi.text_embedding_dims,
  mpi.text_embedding_fingerprint,
  mpi.text_embedding_updated_at,
  mpi.text_embedding_error,
  mpi.vision_catalog_checksum,
  mpi.vision_catalog_synced_at,
  coalesce(mpi.vision_catalog_excluded, false) as vision_catalog_excluded,
  mpi.consult_link_opening_text,
  mpi.consult_link_opening_input_fingerprint,
  mpi.created_at,
  mpi.updated_at
from public.messaging_partner_inventory mpi`

/** DB chưa migration `remarketing_id` — giữ đủ cột khác (gồm stock_qty). */
const INVENTORY_PAGE_SELECT_PRE_REMARKETING = `select
  mpi.id::text as id,
  mpi.partner_id::text as partner_id,
  mpi.sort_order,
  mpi.sku,
  coalesce(mpi.name, '') as name,
  coalesce(mpi.description, '') as description,
  coalesce(mpi.stock_note, '') as stock_note,
  coalesce(mpi.stock_qty, 0) as stock_qty,
  coalesce(mpi.price_hint, '') as price_hint,
  coalesce(mpi.image_url, '') as image_url,
  coalesce(mpi.product_url, '') as product_url,
  coalesce(mpi.product_video_url, '') as product_video_url,
  coalesce(mpi.consult_note, '') as consult_note,
  ''::text as remarketing_id,
  coalesce(mpi.material_note, '') as material_note,
  coalesce(mpi.material_detail_image_url, '') as material_detail_image_url,
  coalesce(mpi.real_use_image_url, '') as real_use_image_url,
  coalesce(mpi.real_use_image_url_2, '') as real_use_image_url_2,
  coalesce(mpi.is_active, true) as is_active,
  null::numeric as price_amount,
  'VND'::text as price_currency,
  mpi.image_embedding_json,
  mpi.image_embedding_vec::text as image_embedding_vec,
  mpi.image_embedding_model,
  mpi.image_embedding_dims,
  mpi.image_embedding_fingerprint,
  mpi.image_embedding_updated_at,
  mpi.image_embedding_error,
  mpi.text_embedding_json,
  mpi.text_embedding_vec::text as text_embedding_vec,
  mpi.text_embedding_model,
  mpi.text_embedding_dims,
  mpi.text_embedding_fingerprint,
  mpi.text_embedding_updated_at,
  mpi.text_embedding_error,
  mpi.vision_catalog_checksum,
  mpi.vision_catalog_synced_at,
  coalesce(mpi.vision_catalog_excluded, false) as vision_catalog_excluded,
  mpi.consult_link_opening_text,
  mpi.consult_link_opening_input_fingerprint,
  mpi.created_at,
  mpi.updated_at
from public.messaging_partner_inventory mpi`

const INVENTORY_PAGE_SELECT_LEGACY = `select
  mpi.id::text as id,
  mpi.partner_id::text as partner_id,
  mpi.sort_order,
  mpi.sku,
  coalesce(mpi.name, '') as name,
  coalesce(mpi.description, '') as description,
  coalesce(mpi.stock_note, '') as stock_note,
  0 as stock_qty,
  coalesce(mpi.price_hint, '') as price_hint,
  coalesce(mpi.image_url, '') as image_url,
  coalesce(mpi.product_url, '') as product_url,
  coalesce(mpi.product_video_url, '') as product_video_url,
  coalesce(mpi.consult_note, '') as consult_note,
  ''::text as remarketing_id,
  coalesce(mpi.material_note, '') as material_note,
  coalesce(mpi.material_detail_image_url, '') as material_detail_image_url,
  coalesce(mpi.real_use_image_url, '') as real_use_image_url,
  coalesce(mpi.real_use_image_url_2, '') as real_use_image_url_2,
  coalesce(mpi.is_active, true) as is_active,
  null::numeric as price_amount,
  'VND'::text as price_currency,
  mpi.image_embedding_json,
  mpi.image_embedding_vec::text as image_embedding_vec,
  mpi.image_embedding_model,
  mpi.image_embedding_dims,
  mpi.image_embedding_fingerprint,
  mpi.image_embedding_updated_at,
  mpi.image_embedding_error,
  mpi.text_embedding_json,
  mpi.text_embedding_vec::text as text_embedding_vec,
  mpi.text_embedding_model,
  mpi.text_embedding_dims,
  mpi.text_embedding_fingerprint,
  mpi.text_embedding_updated_at,
  mpi.text_embedding_error,
  mpi.vision_catalog_checksum,
  mpi.vision_catalog_synced_at,
  coalesce(mpi.vision_catalog_excluded, false) as vision_catalog_excluded,
  mpi.consult_link_opening_text,
  mpi.consult_link_opening_input_fingerprint,
  mpi.created_at,
  mpi.updated_at
from public.messaging_partner_inventory mpi`

async function runInventorySelectWithStockQtyFallback(
  sqlFromSelect: string,
  params: unknown[]
): Promise<PgInventoryRaw[]> {
  try {
    return await pgQuery<PgInventoryRaw>(`${INVENTORY_PAGE_SELECT_WITH_PRODUCT_STUDIO}\n${sqlFromSelect}`, params)
  } catch (e0) {
    if (!isMissingProductStudioColumnError(e0)) throw e0
  }
  try {
    return await pgQuery<PgInventoryRaw>(`${INVENTORY_PAGE_SELECT}\n${sqlFromSelect}`, params)
  } catch (e) {
    if (isMissingPriceAmountColumnError(e)) {
      return await pgQuery<PgInventoryRaw>(`${INVENTORY_PAGE_SELECT_PRE_PRICE_AMOUNT}\n${sqlFromSelect}`, params)
    }
    if (isMissingRemarketingIdColumnError(e)) {
      try {
        return await pgQuery<PgInventoryRaw>(
          `${INVENTORY_PAGE_SELECT_PRE_REMARKETING}\n${sqlFromSelect}`,
          params
        )
      } catch (e2) {
        if (!isMissingInventoryStockQtyColumnError(e2)) throw e2
        return await pgQuery<PgInventoryRaw>(`${INVENTORY_PAGE_SELECT_LEGACY}\n${sqlFromSelect}`, params)
      }
    }
    if (isMissingInventoryStockQtyColumnError(e)) {
      return await pgQuery<PgInventoryRaw>(`${INVENTORY_PAGE_SELECT_LEGACY}\n${sqlFromSelect}`, params)
    }
    throw e
  }
}

export type PartnerInventoryShopListQuery = {
  offset: number
  limit: number
  /** Text search on sku/name/description/price_hint. */
  q?: string
  /** Collection/tag keyword (same ILIKE fields as q). */
  collection?: string
  /** Prefer items that look discounted in price_hint / name. */
  sale?: boolean
  /** Explicit inventory UUID list (collection curated). */
  ids?: string[]
  sort?: 'default' | 'newest' | 'name'
}

export type PartnerCategoryInventoryQuery = {
  offset: number
  limit: number
  categoryId: string
  sort?: 'newest' | 'name' | 'price_asc' | 'price_desc'
  /** W4.11 — khoảng giá (VND). Sản phẩm chưa có `price_amount` (chưa từng sửa/import lại từ W4.10) bị loại khỏi kết quả lọc giá — xem docs/188_BEHAVIOR_SPEC.md mục A.7. */
  minPrice?: number
  maxPrice?: number
  /** W4.11 fashion facets — match option JSON stored in description / stock_note. */
  size?: string
  color?: string
}

/**
 * Trang sản phẩm gán trực tiếp vào 1 danh mục (W4.9/W4.11). Sort mặc định = mới nhất — xem
 * docs/188_BEHAVIOR_SPEC.md mục A.4 (cố ý KHÔNG copy sort=random mặc định của 188).
 * `null` = không pool hoặc lỗi — caller xử lý khi không có PG.
 */
export async function fetchPartnerInventoryPageByCategoryFromPg(
  partnerId: string,
  query: PartnerCategoryInventoryQuery
): Promise<{ rows: MessagingPartnerInventoryRow[]; count: number } | null> {
  if (!isPgConfigured()) return null
  const off = Math.max(0, Math.floor(query.offset))
  const lim = Math.max(1, Math.min(96, Math.floor(query.limit)))
  const categoryId = query.categoryId.trim()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(categoryId)) {
    return { rows: [], count: 0 }
  }
  const orderBy =
    query.sort === 'name'
      ? 'lower(mpi.name) asc, mpi.sort_order asc'
      : query.sort === 'price_asc'
        ? 'mpi.price_amount asc nulls last, mpi.sort_order asc'
        : query.sort === 'price_desc'
          ? 'mpi.price_amount desc nulls last, mpi.sort_order asc'
          : 'mpi.created_at desc nulls last, mpi.sort_order asc'

  const conditions = [
    'mpi.partner_id = $1::uuid',
    'coalesce(mpi.is_active, true) = true',
    `exists (
      select 1 from public.messaging_partner_inventory_categories pic
      where pic.inventory_id = mpi.id and pic.category_id = $2::uuid
    )`,
  ]
  const params: unknown[] = [partnerId, categoryId]
  const minPrice = typeof query.minPrice === 'number' && Number.isFinite(query.minPrice) ? Math.max(0, query.minPrice) : null
  const maxPrice = typeof query.maxPrice === 'number' && Number.isFinite(query.maxPrice) ? Math.max(0, query.maxPrice) : null
  if (minPrice !== null) {
    params.push(minPrice)
    conditions.push(`mpi.price_amount >= $${params.length}::numeric`)
  }
  if (maxPrice !== null) {
    params.push(maxPrice)
    conditions.push(`mpi.price_amount <= $${params.length}::numeric`)
  }
  const size = String(query.size ?? '').trim().slice(0, 40)
  const color = String(query.color ?? '').trim().slice(0, 40)
  if (size) {
    params.push(`%"${size.replace(/"/g, '')}"%`)
    conditions.push(`coalesce(mpi.description, '') like $${params.length}`)
  }
  if (color) {
    params.push(`%"${color.replace(/"/g, '')}"%`)
    conditions.push(`coalesce(mpi.stock_note, '') like $${params.length}`)
  }
  const where = conditions.join(' and ')

  try {
    const countRow = await pgQueryOne<{ c: number }>(
      `select count(*)::int as c from public.messaging_partner_inventory mpi where ${where}`,
      params
    )
    const limitIdx = params.length + 1
    const offsetIdx = params.length + 2
    const rows = await runInventorySelectWithStockQtyFallback(
      `where ${where}
       order by ${orderBy}
       limit $${limitIdx} offset $${offsetIdx}`,
      [...params, lim, off]
    )
    return { count: countRow?.c ?? 0, rows: rows.map(mapPgInventoryRow) }
  } catch (e) {
    if (isMissingInventoryTableError(e)) return { rows: [], count: 0 }
    console.warn('[fetchPartnerInventoryPageByCategoryFromPg]', e)
    return null
  }
}

/** W4.11 — facet value counts for a category (fashion size/color from option JSON). */
export async function fetchPartnerCategoryFacetCountsFromPg(
  partnerId: string,
  categoryId: string
): Promise<{ sizes: Array<{ value: string; count: number }>; colors: Array<{ value: string; count: number }> } | null> {
  if (!isPgConfigured()) return null
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(categoryId)) {
    return { sizes: [], colors: [] }
  }
  try {
    type FacetRow = {
      description: string
      stock_note: string
      sizes_json?: unknown
      colors_json?: unknown
    }
    let rows: FacetRow[]
    try {
      rows = await pgQuery<FacetRow>(
        `select coalesce(mpi.description, '') as description, coalesce(mpi.stock_note, '') as stock_note,
                mpi.sizes_json, mpi.colors_json
         from public.messaging_partner_inventory mpi
         where mpi.partner_id = $1::uuid
           and coalesce(mpi.is_active, true) = true
           and exists (
             select 1 from public.messaging_partner_inventory_categories pic
             where pic.inventory_id = mpi.id and pic.category_id = $2::uuid
           )
         limit 500`,
        [partnerId, categoryId]
      )
    } catch (e) {
      if (!isMissingProductStudioColumnError(e)) throw e
      rows = await pgQuery<FacetRow>(
        `select coalesce(mpi.description, '') as description, coalesce(mpi.stock_note, '') as stock_note
         from public.messaging_partner_inventory mpi
         where mpi.partner_id = $1::uuid
           and coalesce(mpi.is_active, true) = true
           and exists (
             select 1 from public.messaging_partner_inventory_categories pic
             where pic.inventory_id = mpi.id and pic.category_id = $2::uuid
           )
         limit 500`,
        [partnerId, categoryId]
      )
    }
    const {
      parseInventorySizesForFacet,
      parseInventoryColorsForFacet,
    } = await import('@/lib/partner-website/shop/partner-shop-industry-facets')
    const sizeMap = new Map<string, number>()
    const colorMap = new Map<string, number>()
    for (const r of rows) {
      const structuredSizes = parseSizesJsonColumn(r.sizes_json)
      const structuredColors = parseColorsJsonColumn(r.colors_json)
      for (const s of parseInventorySizesForFacet(r.description, structuredSizes)) {
        sizeMap.set(s, (sizeMap.get(s) ?? 0) + 1)
      }
      for (const c of parseInventoryColorsForFacet(r.stock_note, structuredColors)) {
        colorMap.set(c, (colorMap.get(c) ?? 0) + 1)
      }
    }
    const toList = (m: Map<string, number>) =>
      [...m.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
        .slice(0, 40)
    return { sizes: toList(sizeMap), colors: toList(colorMap) }
  } catch (e) {
    console.warn('[fetchPartnerCategoryFacetCountsFromPg]', e)
    return null
  }
}

/** W4.11 — min/max `price_amount` trong 1 danh mục, cho UI hiển thị khoảng giá gợi ý. */
export async function fetchPartnerCategoryPriceRangeFromPg(
  partnerId: string,
  categoryId: string
): Promise<{ min: number; max: number } | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ min_price: string | number | null; max_price: string | number | null }>(
      `select min(mpi.price_amount) as min_price, max(mpi.price_amount) as max_price
       from public.messaging_partner_inventory mpi
       where mpi.partner_id = $1::uuid
         and coalesce(mpi.is_active, true) = true
         and mpi.price_amount is not null
         and exists (
           select 1 from public.messaging_partner_inventory_categories pic
           where pic.inventory_id = mpi.id and pic.category_id = $2::uuid
         )`,
      [partnerId, categoryId]
    )
    if (!row || row.min_price == null || row.max_price == null) return null
    return { min: Number(row.min_price), max: Number(row.max_price) }
  } catch (e) {
    if (isMissingInventoryTableError(e)) return null
    console.warn('[fetchPartnerCategoryPriceRangeFromPg]', e)
    return null
  }
}

/**
 * Trang inventory active + tổng số (Postgres). `null` = không pool hoặc lỗi — caller xử lý khi không có PG.
 */
export async function fetchPartnerInventoryActivePageWithCountFromPg(
  partnerId: string,
  offset: number,
  limit: number
): Promise<{ rows: MessagingPartnerInventoryRow[]; count: number } | null> {
  return fetchPartnerInventoryShopPageFromPg(partnerId, { offset, limit, sort: 'default' })
}

/**
 * Shop catalog page with optional filters (search / collection / sale / ids / sort).
 */
export async function fetchPartnerInventoryShopPageFromPg(
  partnerId: string,
  query: PartnerInventoryShopListQuery
): Promise<{ rows: MessagingPartnerInventoryRow[]; count: number } | null> {
  if (!isPgConfigured()) return null
  const off = Math.max(0, Math.floor(query.offset))
  const lim = Math.max(1, Math.min(48, Math.floor(query.limit)))
  const q = String(query.q ?? '').trim().slice(0, 80)
  const collection = String(query.collection ?? '').trim().slice(0, 80)
  const ids = (query.ids ?? [])
    .map((id) => id.trim())
    .filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    .slice(0, 48)
  const sort = query.sort === 'newest' || query.sort === 'name' ? query.sort : 'default'

  const conditions = ['mpi.partner_id = $1::uuid', 'coalesce(mpi.is_active, true) = true']
  const filterParams: unknown[] = [partnerId]

  if (ids.length) {
    filterParams.push(ids)
    conditions.push(`mpi.id = any($${filterParams.length}::uuid[])`)
  }

  const textToken = (q || collection).replace(/[%_]/g, '')
  if (textToken) {
    filterParams.push(`%${textToken}%`)
    const p = `$${filterParams.length}`
    conditions.push(
      `(coalesce(mpi.sku, '') ilike ${p}
        or coalesce(mpi.name, '') ilike ${p}
        or coalesce(mpi.description, '') ilike ${p}
        or coalesce(mpi.price_hint, '') ilike ${p}
        or coalesce(mpi.consult_note, '') ilike ${p})`
    )
  }

  if (query.sale) {
    conditions.push(
      `(coalesce(mpi.price_hint, '') ~* '(%|sale|giảm|giam|-\\s*\\d)'
        or coalesce(mpi.name, '') ~* '(sale|giảm|giam|flash)')`
    )
  }

  const where = conditions.join(' and ')
  let orderBy = 'mpi.sort_order asc'
  const selectParams = [...filterParams]
  if (sort === 'newest') {
    orderBy = 'mpi.created_at desc nulls last, mpi.sort_order asc'
  } else if (sort === 'name') {
    orderBy = 'lower(mpi.name) asc, mpi.sort_order asc'
  } else if (ids.length) {
    selectParams.push(ids)
    orderBy = `array_position($${selectParams.length}::uuid[], mpi.id) nulls last, mpi.sort_order asc`
  }

  try {
    const countRow = await pgQueryOne<{ c: number }>(
      `select count(*)::int as c
       from public.messaging_partner_inventory mpi
       where ${where}`,
      filterParams
    )

    const limitIdx = selectParams.length + 1
    const offsetIdx = selectParams.length + 2
    const rows = await runInventorySelectWithStockQtyFallback(
      `where ${where}
       order by ${orderBy}
       limit $${limitIdx} offset $${offsetIdx}`,
      [...selectParams, lim, off]
    )
    return {
      count: countRow?.c ?? 0,
      rows: rows.map(mapPgInventoryRow),
    }
  } catch (e) {
    if (isMissingInventoryTableError(e)) {
      return { rows: [], count: 0 }
    }
    console.warn('[fetchPartnerInventoryShopPageFromPg]', e)
    return null
  }
}

/**
 * `id` → `price_hint` cho các dòng inventory của partner (Postgres).
 * `null` = không pool hoặc lỗi — caller caller xử lý khi không có PG.
 */
export async function fetchPartnerInventoryPriceHintsByIdsFromPg(
  partnerId: string,
  inventoryIds: string[]
): Promise<Map<string, string> | null> {
  if (!isPgConfigured() || inventoryIds.length === 0) return null
  try {
    const rows = await pgQuery<{ id: string; price_hint: string | null }>(
      `select id::text, coalesce(price_hint, '') as price_hint
       from public.messaging_partner_inventory
       where partner_id = $1::uuid and id = any($2::uuid[])`,
      [partnerId, inventoryIds]
    )
    const m = new Map<string, string>()
    for (const r of rows) {
      m.set(r.id, String(r.price_hint ?? ''))
    }
    return m
  } catch (e) {
    console.warn('[fetchPartnerInventoryPriceHintsByIdsFromPg]', e)
    return null
  }
}

/** Dữ liệu giá + ảnh phụ (chi tiết / màu) cho API tìm kho; một query theo nhiều id. */
export type PartnerInventorySearchEnrichment = {
  price_hint: string
  /** Có thể chứa JSON màu [{name,img}] (Excel «Màu sắc») hoặc ghi chú tồn dạng chữ (Open Catalog). */
  stock_note: string
  material_detail_image_url: string
  real_use_image_url: string
  real_use_image_url_2: string
}

/**
 * Các URL ảnh phụ từ kho (trừ trùng ảnh chính) — dùng cho trường `color_image_urls` trong API tìm.
 * @deprecated Import from `@/lib/messaging/inventory-extra-image-urls` (client-safe).
 */
export { colorImageUrlsForInventorySearch } from '@/lib/messaging/inventory-extra-image-urls'

export async function fetchPartnerInventorySearchEnrichmentByIdsFromPg(
  partnerId: string,
  inventoryIds: string[]
): Promise<Map<string, PartnerInventorySearchEnrichment> | null> {
  if (!isPgConfigured() || inventoryIds.length === 0) return null
  try {
    const rows = await pgQuery<{
      id: string
      price_hint: string | null
      stock_note: string | null
      material_detail_image_url: string | null
      real_use_image_url: string | null
      real_use_image_url_2: string | null
    }>(
      `select id::text,
              coalesce(price_hint, '') as price_hint,
              coalesce(stock_note, '') as stock_note,
              coalesce(material_detail_image_url, '') as material_detail_image_url,
              coalesce(real_use_image_url, '') as real_use_image_url,
              coalesce(real_use_image_url_2, '') as real_use_image_url_2
       from public.messaging_partner_inventory
       where partner_id = $1::uuid and id = any($2::uuid[])`,
      [partnerId, inventoryIds]
    )
    const m = new Map<string, PartnerInventorySearchEnrichment>()
    for (const r of rows) {
      m.set(r.id, {
        price_hint: String(r.price_hint ?? ''),
        stock_note: String(r.stock_note ?? ''),
        material_detail_image_url: String(r.material_detail_image_url ?? ''),
        real_use_image_url: String(r.real_use_image_url ?? ''),
        real_use_image_url_2: String(r.real_use_image_url_2 ?? ''),
      })
    }
    return m
  } catch (e) {
    console.warn('[fetchPartnerInventorySearchEnrichmentByIdsFromPg]', e)
    return null
  }
}

/** Giống `sanitizeInventorySearchToken` trong partner-inventory-ai-search (tránh import vòng). */
function sanitizeTokenForInventoryLike(raw: string): string {
  return raw.replace(/[%_,().]/g, '').trim().slice(0, 64)
}

/**
 * Danh sách mặc định cho ngữ cảnh AI: active, sort_order, giới hạn N dòng.
 * `null` = lỗi / chưa cấu hình PG — caller xử lý khi không có PG.
 */
export async function fetchPartnerInventoryDefaultForAiFromPg(
  partnerId: string,
  limit: number
): Promise<MessagingPartnerInventoryRow[] | null> {
  if (!isPgConfigured()) return null
  const lim = Math.max(1, Math.floor(limit))
  try {
    const rows = await runInventorySelectWithStockQtyFallback(
      `where mpi.partner_id = $1::uuid and coalesce(mpi.is_active, true) = true
       order by mpi.sort_order asc
       limit $2`,
      [partnerId, lim]
    )
    return rows.map(mapPgInventoryRow)
  } catch (e) {
    console.warn('[fetchPartnerInventoryDefaultForAiFromPg]', e)
    return null
  }
}

/**
 * ILIKE trên sku / name / description / price_hint (một token đã làm sạch).
 * `null` = lỗi / chưa cấu hình PG.
 */
export async function fetchPartnerInventoryRowsByTokenIlikeFromPg(
  partnerId: string,
  token: string,
  limit: number
): Promise<MessagingPartnerInventoryRow[] | null> {
  if (!isPgConfigured()) return null
  const clean = sanitizeTokenForInventoryLike(token).replace(/[%_]/g, '')
  if (clean.length < 2) return []
  const lim = Math.max(1, Math.floor(limit))
  const pattern = `%${clean}%`
  try {
    const rows = await runInventorySelectWithStockQtyFallback(
      `where mpi.partner_id = $1::uuid
         and coalesce(mpi.is_active, true) = true
         and (
           coalesce(mpi.sku, '') ilike $2
           or coalesce(mpi.name, '') ilike $2
           or coalesce(mpi.description, '') ilike $2
           or coalesce(mpi.price_hint, '') ilike $2
         )
       limit $3`,
      [partnerId, pattern, lim]
    )
    return rows.map(mapPgInventoryRow)
  } catch (e) {
    console.warn('[fetchPartnerInventoryRowsByTokenIlikeFromPg]', e)
    return null
  }
}

/**
 * Một lần query: hàng nào khớp **bất kỳ** pattern ILIKE nào (sku/name/description/price_hint).
 * Dùng cho AI inbox — thay vì N vòng gọi theo từng token.
 */
export async function fetchPartnerInventoryRowsByTokensIlikeAnyFromPg(
  partnerId: string,
  tokens: string[],
  limit: number
): Promise<MessagingPartnerInventoryRow[] | null> {
  if (!isPgConfigured()) return null
  const patterns: string[] = []
  for (const raw of tokens) {
    const clean = sanitizeTokenForInventoryLike(raw).replace(/[%_]/g, '')
    if (clean.length >= 2) patterns.push(`%${clean}%`)
  }
  if (!patterns.length) return []
  const lim = Math.min(500, Math.max(80, Math.floor(limit)))
  try {
    const rows = await runInventorySelectWithStockQtyFallback(
      `where mpi.partner_id = $1::uuid
         and coalesce(mpi.is_active, true) = true
         and exists (
           select 1
           from unnest($2::text[]) as q(pattern)
           where coalesce(mpi.sku, '') ilike q.pattern
              or coalesce(mpi.name, '') ilike q.pattern
              or coalesce(mpi.description, '') ilike q.pattern
              or coalesce(mpi.price_hint, '') ilike q.pattern
         )
       limit $3`,
      [partnerId, patterns, lim]
    )
    return rows.map(mapPgInventoryRow)
  } catch (e) {
    console.warn('[fetchPartnerInventoryRowsByTokensIlikeAnyFromPg]', e)
    return null
  }
}

export async function fetchPartnerInventoryRowByProductUrlFromPg(
  partnerId: string,
  productUrl: string
): Promise<MessagingPartnerInventoryRow | null> {
  if (!isPgConfigured()) return null
  const u = String(productUrl ?? '').trim()
  if (!u) return null
  try {
    const rows = await runInventorySelectWithStockQtyFallback(
      `where mpi.partner_id = $1::uuid
         and coalesce(mpi.is_active, true) = true
         and coalesce(mpi.product_url, '') = $2
       order by mpi.sort_order asc
       limit 1`,
      [partnerId, u]
    )
    const row = rows[0] ?? null
    return row ? mapPgInventoryRow(row) : null
  } catch (e) {
    console.warn('[fetchPartnerInventoryRowByProductUrlFromPg]', e)
    return null
  }
}

/** Khớp dòng kho theo `normalizeProductUrlKey` (URL trên kho có thể khác dấu `/` cuối). */
export async function fetchPartnerInventoryRowByProductUrlNormKeyFromPg(
  partnerId: string,
  productUrlKey: string
): Promise<MessagingPartnerInventoryRow | null> {
  if (!isPgConfigured()) return null
  const want = normalizeProductUrlKey(productUrlKey.trim())
  if (!want) return null
  const exact = await fetchPartnerInventoryRowByProductUrlFromPg(partnerId, want)
  if (exact) return exact
  const alt = want.endsWith('/') ? want.replace(/\/+$/, '') : `${want}/`
  const exact2 = await fetchPartnerInventoryRowByProductUrlFromPg(partnerId, alt)
  if (exact2) return exact2
  try {
    const rows = await runInventorySelectWithStockQtyFallback(
      `where mpi.partner_id = $1::uuid
         and coalesce(mpi.is_active, true) = true
         and trim(coalesce(mpi.product_url, '')) <> ''
       order by mpi.sort_order asc`,
      [partnerId]
    )
    for (const raw of rows) {
      const row = mapPgInventoryRow(raw)
      const pu = row.product_url.trim()
      if (!pu) continue
      if (normalizeProductUrlKey(pu) === want) return row
    }
  } catch (e) {
    console.warn('[fetchPartnerInventoryRowByProductUrlNormKeyFromPg]', e)
  }
  return null
}

/** Khớp SKU đã chuẩn hoá (bỏ khoảng trắng, dấu gạch…) — dùng với mã trên thẻ sản phẩm AI. */
export async function fetchPartnerInventoryRowByComparableSkuFromPg(
  partnerId: string,
  skuRaw: string
): Promise<MessagingPartnerInventoryRow | null> {
  if (!isPgConfigured()) return null
  const norm = String(skuRaw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s._-]+/g, '')
    .replace(/[^a-z0-9]/g, '')
  if (!norm) return null
  try {
    const rows = await runInventorySelectWithStockQtyFallback(
      `where mpi.partner_id = $1::uuid
         and coalesce(mpi.is_active, true)
         and regexp_replace(lower(trim(coalesce(mpi.sku,''))), '[^a-z0-9]', '', 'g') = $2
       limit 1`,
      [partnerId, norm]
    )
    const row = rows[0] ?? null
    return row ? mapPgInventoryRow(row) : null
  } catch (e) {
    console.warn('[fetchPartnerInventoryRowByComparableSkuFromPg]', e)
    return null
  }
}

/** Khớp đúng URL ảnh sản phẩm trên kho (thẻ AI thường trùng `image_url`). */
export async function fetchPartnerInventoryRowByImageUrlFromPg(
  partnerId: string,
  imageUrl: string
): Promise<MessagingPartnerInventoryRow | null> {
  if (!isPgConfigured()) return null
  const u = String(imageUrl ?? '').trim()
  if (!u || !/^https?:\/\//i.test(u)) return null
  try {
    const rows = await runInventorySelectWithStockQtyFallback(
      `where mpi.partner_id = $1::uuid
         and coalesce(mpi.is_active, true)
         and trim(coalesce(mpi.image_url, '')) = $2
       limit 1`,
      [partnerId, u]
    )
    const row = rows[0] ?? null
    return row ? mapPgInventoryRow(row) : null
  } catch (e) {
    console.warn('[fetchPartnerInventoryRowByImageUrlFromPg]', e)
    return null
  }
}

export async function fetchPartnerInventoryRowByIdForPartnerFromPg(
  partnerId: string,
  inventoryId: string
): Promise<MessagingPartnerInventoryRow | null> {
  if (!isPgConfigured()) return null
  try {
    const rows = await runInventorySelectWithStockQtyFallback(
      `where mpi.partner_id = $1::uuid and mpi.id = $2::uuid
       limit 1`,
      [partnerId, inventoryId]
    )
    const row = rows[0] ?? null
    return row ? mapPgInventoryRow(row) : null
  } catch (e) {
    console.warn('[fetchPartnerInventoryRowByIdForPartnerFromPg]', e)
    return null
  }
}

/** Resolve `/products/{name-slug}-{uuid8}` via id text prefix (first 8 hex of UUID). */
export async function fetchPartnerInventoryRowByIdPrefixForPartnerFromPg(
  partnerId: string,
  idPrefix: string
): Promise<MessagingPartnerInventoryRow | null> {
  if (!isPgConfigured()) return null
  const prefix = idPrefix.trim().toLowerCase()
  if (!/^[0-9a-f]{8}$/.test(prefix)) return null
  try {
    const rows = await runInventorySelectWithStockQtyFallback(
      `where mpi.partner_id = $1::uuid
         and mpi.id::text like $2
       order by mpi.updated_at desc nulls last
       limit 1`,
      [partnerId, `${prefix}-%`]
    )
    const row = rows[0] ?? null
    return row ? mapPgInventoryRow(row) : null
  } catch (e) {
    console.warn('[fetchPartnerInventoryRowByIdPrefixForPartnerFromPg]', e)
    return null
  }
}

export async function fetchPartnerInventoryRowBySkuForPartnerFromPg(
  partnerId: string,
  sku: string
): Promise<MessagingPartnerInventoryRow | null> {
  if (!isPgConfigured()) return null
  const normalizedSku = sku.trim()
  if (!normalizedSku) return null
  try {
    const rows = await runInventorySelectWithStockQtyFallback(
      `where mpi.partner_id = $1::uuid
         and coalesce(mpi.is_active, true) = true
         and lower(trim(coalesce(mpi.sku, ''))) = lower($2)
       limit 1`,
      [partnerId, normalizedSku]
    )
    const row = rows[0] ?? null
    return row ? mapPgInventoryRow(row) : null
  } catch (e) {
    console.warn('[fetchPartnerInventoryRowBySkuForPartnerFromPg]', e)
    return null
  }
}

/** Fingerprint đầu vào tin mở đầu link tư vấn — khớp với `productName` + `extraContext` + SKU dùng trong prompt. */
export function computeConsultLinkOpeningInputFingerprint(
  productName: string,
  extraContext: string,
  skuLine: string
): string {
  const p = `${String(productName)}\x1e${String(extraContext)}\x1e${String(skuLine)}`
  return createHash('sha256').update(p, 'utf8').digest('hex')
}

/** Lưu cache tin mở đầu (sau khi AI hoặc fallback tạo xong). */
export async function savePartnerInventoryConsultLinkOpeningCacheFromPg(
  partnerId: string,
  inventoryId: string,
  messageText: string,
  inputFingerprint: string
): Promise<boolean> {
  if (!isPgConfigured()) return false
  const text = messageText.trim()
  if (!text || text.length < 12) return false
  if (!inputFingerprint.trim()) return false
  try {
    const r = await getPgPool().query(
      `update public.messaging_partner_inventory
       set consult_link_opening_text = $3,
           consult_link_opening_input_fingerprint = $4,
           updated_at = now()
       where partner_id = $1::uuid and id = $2::uuid`,
      [partnerId, inventoryId, text, inputFingerprint]
    )
    return (r.rowCount ?? 0) > 0
  } catch (e) {
    console.warn('[savePartnerInventoryConsultLinkOpeningCacheFromPg]', e)
    return false
  }
}

/** Kết quả RPC `match_messaging_partner_inventory_by_embedding` (pgvector). */
export type MatchPartnerInventoryEmbeddingRow = {
  inventory_id: string
  name: string
  sku: string | null
  image_url: string
  product_url: string | null
  score: number
}

/**
 * ANN search embedding ảnh (gọi cùng function SQL đã có trong DB).
 * `null` = không pool / lỗi — caller xử lý khi không có PG.
 */
export async function matchPartnerInventoryByEmbeddingFromPg(
  partnerId: string,
  queryVectorLiteral: string,
  limit: number,
  minScore: number
): Promise<MatchPartnerInventoryEmbeddingRow[] | null> {
  if (!isPgConfigured()) return null
  const lim = Math.max(1, Math.min(PARTNER_PUBLIC_INVENTORY_SEARCH_MAX, Math.floor(limit)))
  try {
    const rows = await pgQuery<{
      inventory_id: string
      name: string
      sku: string | null
      image_url: string
      product_url: string | null
      score: string | number
    }>(
      `select * from public.match_messaging_partner_inventory_by_embedding(
        $1::uuid,
        $2::vector(768),
        $3::int,
        $4::double precision
      )`,
      [partnerId, queryVectorLiteral, lim, minScore]
    )
    return rows.map((r) => ({
      inventory_id: String(r.inventory_id),
      name: String(r.name ?? ''),
      sku: r.sku ?? null,
      image_url: String(r.image_url ?? ''),
      product_url: r.product_url ?? null,
      score: typeof r.score === 'number' ? r.score : Number(r.score),
    }))
  } catch (e) {
    console.warn('[matchPartnerInventoryByEmbeddingFromPg]', e)
    return null
  }
}

/** ANN theo embedding văn bản (tên + giá + ghi chú tư vấn). */
export async function matchPartnerInventoryByTextEmbeddingFromPg(
  partnerId: string,
  queryVectorLiteral: string,
  limit: number,
  minScore: number
): Promise<MatchPartnerInventoryEmbeddingRow[] | null> {
  if (!isPgConfigured()) return null
  const lim = Math.max(1, Math.min(PARTNER_PUBLIC_INVENTORY_SEARCH_MAX, Math.floor(limit)))
  try {
    const rows = await pgQuery<{
      inventory_id: string
      name: string
      sku: string | null
      image_url: string
      product_url: string | null
      score: string | number
    }>(
      `select * from public.match_messaging_partner_inventory_by_text_embedding(
        $1::uuid,
        $2::vector(768),
        $3::int,
        $4::double precision
      )`,
      [partnerId, queryVectorLiteral, lim, minScore]
    )
    return rows.map((r) => ({
      inventory_id: String(r.inventory_id),
      name: String(r.name ?? ''),
      sku: r.sku ?? null,
      image_url: String(r.image_url ?? ''),
      product_url: r.product_url ?? null,
      score: typeof r.score === 'number' ? r.score : Number(r.score),
    }))
  } catch (e) {
    console.warn('[matchPartnerInventoryByTextEmbeddingFromPg]', e)
    return null
  }
}

/**
 * Nhiều id inventory của partner (đồng bộ embedding).
 * `null` = lỗi — caller xử lý khi không có PG.
 */
export async function fetchPartnerInventoryRowsByIdsForEmbeddingSyncFromPg(
  partnerId: string,
  ids: string[]
): Promise<MessagingPartnerInventoryRow[] | null> {
  if (!isPgConfigured() || ids.length === 0) return null
  try {
    const rows = await runInventorySelectWithStockQtyFallback(
      `where mpi.partner_id = $1::uuid and mpi.id = any($2::uuid[])`,
      [partnerId, ids]
    )
    return rows.map(mapPgInventoryRow)
  } catch (e) {
    console.warn('[fetchPartnerInventoryRowsByIdsForEmbeddingSyncFromPg]', e)
    return null
  }
}

/**
 * Trang theo `updated_at` tăng dần (quét cần sync embedding).
 * `null` = lỗi — caller xử lý khi không có PG.
 */
export async function fetchPartnerInventorySliceByUpdatedAtAscFromPg(
  partnerId: string,
  limit: number,
  offset: number
): Promise<MessagingPartnerInventoryRow[] | null> {
  if (!isPgConfigured()) return null
  const lim = Math.max(1, Math.floor(limit))
  const off = Math.max(0, Math.floor(offset))
  try {
    const rows = await runInventorySelectWithStockQtyFallback(
      `where mpi.partner_id = $1::uuid
       order by mpi.updated_at asc nulls last
       limit $2 offset $3`,
      [partnerId, lim, off]
    )
    return rows.map(mapPgInventoryRow)
  } catch (e) {
    console.warn('[fetchPartnerInventorySliceByUpdatedAtAscFromPg]', e)
    return null
  }
}

/**
 * Trang ưu tiên mục chưa embed (`*_embedding_updated_at` null) trước — tránh bỏ sót
 * khi kho > GEMINI_*_EMBED_SCAN_MAX_ROWS và các SP mới import có `updated_at` mới hơn.
 */
export async function fetchPartnerInventorySliceForEmbeddingSyncFromPg(
  partnerId: string,
  limit: number,
  offset: number,
  kind: 'image' | 'text'
): Promise<MessagingPartnerInventoryRow[] | null> {
  if (!isPgConfigured()) return null
  const lim = Math.max(1, Math.floor(limit))
  const off = Math.max(0, Math.floor(offset))
  const updatedCol = kind === 'image' ? 'image_embedding_updated_at' : 'text_embedding_updated_at'
  const errorCol = kind === 'image' ? 'image_embedding_error' : 'text_embedding_error'
  const eligibleFilter =
    kind === 'image'
      ? `and coalesce(mpi.is_active, true)
         and (
           trim(coalesce(mpi.image_url, '')) ~* '^https?://'
           or trim(coalesce(mpi.image_url, '')) like '//%'
         )`
      : `and coalesce(mpi.is_active, true)
         and (
           trim(coalesce(mpi.name, '')) <> ''
           or trim(coalesce(mpi.price_hint, '')) <> ''
           or trim(coalesce(mpi.consult_note, '')) <> ''
         )`
  try {
    const rows = await runInventorySelectWithStockQtyFallback(
      `where mpi.partner_id = $1::uuid
       ${eligibleFilter}
       order by (case when trim(coalesce(mpi.${errorCol}, '')) <> '' then 0 else 1 end),
                mpi.${updatedCol} asc nulls first,
                mpi.updated_at asc nulls last
       limit $2 offset $3`,
      [partnerId, lim, off]
    )
    return rows.map(mapPgInventoryRow)
  } catch (e) {
    console.warn('[fetchPartnerInventorySliceForEmbeddingSyncFromPg]', e)
    return null
  }
}

export type PartnerInventoryEmbeddingUpdatePatch = {
  image_embedding_json: number[] | null
  image_embedding_fingerprint: string
  image_embedding_model: string
  image_embedding_dims: number
  image_embedding_vec: string | null
  image_embedding_updated_at: string
  image_embedding_error: string | null
}

export type PartnerInventoryTextEmbeddingUpdatePatch = {
  text_embedding_json: number[] | null
  text_embedding_fingerprint: string
  text_embedding_model: string
  text_embedding_dims: number
  text_embedding_vec: string | null
  text_embedding_updated_at: string
  text_embedding_error: string | null
}

/**
 * Cập nhật các cột embedding sau khi gọi Gemini. `true` nếu có đúng 1 dòng đổi.
 * `false` = không pool hoặc lỗi — caller cập nhật bằng đường khác nếu còn hỗ trợ.
 */
export async function updatePartnerInventoryEmbeddingFieldsFromPg(
  partnerId: string,
  inventoryId: string,
  patch: PartnerInventoryEmbeddingUpdatePatch
): Promise<boolean> {
  if (!isPgConfigured()) return false
  const jsonPayload =
    patch.image_embedding_json == null ? null : JSON.stringify(patch.image_embedding_json)
  try {
    const rows = await pgQuery<{ id: string }>(
      `update public.messaging_partner_inventory set
        image_embedding_json = $3::jsonb,
        image_embedding_fingerprint = $4,
        image_embedding_model = $5,
        image_embedding_dims = $6,
        image_embedding_vec = $7::vector(768),
        image_embedding_updated_at = $8::timestamptz,
        image_embedding_error = $9
      where partner_id = $1::uuid and id = $2::uuid
      returning id::text as id`,
      [
        partnerId,
        inventoryId,
        jsonPayload,
        patch.image_embedding_fingerprint,
        patch.image_embedding_model,
        patch.image_embedding_dims,
        patch.image_embedding_vec,
        patch.image_embedding_updated_at,
        patch.image_embedding_error,
      ]
    )
    return rows.length > 0
  } catch (e) {
    console.warn('[updatePartnerInventoryEmbeddingFieldsFromPg]', e)
    return false
  }
}

export async function updatePartnerInventoryTextEmbeddingFieldsFromPg(
  partnerId: string,
  inventoryId: string,
  patch: PartnerInventoryTextEmbeddingUpdatePatch
): Promise<boolean> {
  if (!isPgConfigured()) return false
  const jsonPayload =
    patch.text_embedding_json == null ? null : JSON.stringify(patch.text_embedding_json)
  try {
    const rows = await pgQuery<{ id: string }>(
      `update public.messaging_partner_inventory set
        text_embedding_json = $3::jsonb,
        text_embedding_fingerprint = $4,
        text_embedding_model = $5,
        text_embedding_dims = $6,
        text_embedding_vec = $7::vector(768),
        text_embedding_updated_at = $8::timestamptz,
        text_embedding_error = $9
      where partner_id = $1::uuid and id = $2::uuid
      returning id::text as id`,
      [
        partnerId,
        inventoryId,
        jsonPayload,
        patch.text_embedding_fingerprint,
        patch.text_embedding_model,
        patch.text_embedding_dims,
        patch.text_embedding_vec,
        patch.text_embedding_updated_at,
        patch.text_embedding_error,
      ]
    )
    return rows.length > 0
  } catch (e) {
    console.warn('[updatePartnerInventoryTextEmbeddingFieldsFromPg]', e)
    return false
  }
}

/**
 * Lấy đủ dòng inventory theo thứ tự `ids` (giữ thứ tự để merge với điểm ANN).
 */
export async function fetchPartnerInventoryRowsByIdsInOrderFromPg(
  partnerId: string,
  ids: string[]
): Promise<MessagingPartnerInventoryRow[] | null> {
  if (!isPgConfigured() || ids.length === 0) return null
  const clean = ids.map((x) => x.trim()).filter(Boolean)
  if (!clean.length) return null
  try {
    const rows = await runInventorySelectWithStockQtyFallback(
      `where mpi.partner_id = $1::uuid and mpi.id = any($2::uuid[])
       order by array_position($2::uuid[], mpi.id)`,
      [partnerId, clean]
    )
    return rows.map(mapPgInventoryRow)
  } catch (e) {
    console.warn('[fetchPartnerInventoryRowsByIdsInOrderFromPg]', e)
    return null
  }
}

/**
 * Toàn bộ dòng inventory của partner, `created_at` / `id` tăng (giống import batch).
 * `null` = lỗi — caller xử lý khi không có PG.
 */
export async function fetchPartnerInventoryFullListOrderedCreatedFromPg(
  partnerId: string
): Promise<MessagingPartnerInventoryRow[] | null> {
  if (!isPgConfigured()) return null
  const all: MessagingPartnerInventoryRow[] = []
  let from = 0
  try {
    while (true) {
      const rows = await runInventorySelectWithStockQtyFallback(
        `where mpi.partner_id = $1::uuid
         order by mpi.created_at asc nulls last, mpi.id asc
         limit $2 offset $3`,
        [partnerId, INVENTORY_FULL_LIST_PAGE, from]
      )
      if (rows.length === 0) break
      all.push(...rows.map(mapPgInventoryRow))
      if (rows.length < INVENTORY_FULL_LIST_PAGE) break
      from += INVENTORY_FULL_LIST_PAGE
    }
    return all
  } catch (e) {
    console.warn('[fetchPartnerInventoryFullListOrderedCreatedFromPg]', e)
    return null
  }
}

/** `true` nếu chạy xong; `false` = không pool hoặc lỗi. */
export async function deletePartnerInventoryByIdsForPartnerFromPg(
  partnerId: string,
  ids: string[]
): Promise<boolean> {
  if (!isPgConfigured()) return false
  if (ids.length === 0) return true
  try {
    await getPgPool().query(
      `delete from public.messaging_partner_inventory
       where partner_id = $1::uuid and id = any($2::uuid[])`,
      [partnerId, ids]
    )
    return true
  } catch (e) {
    console.warn('[deletePartnerInventoryByIdsForPartnerFromPg]', e)
    return false
  }
}

function inventoryInsertRowParams(r: MessagingPartnerInventoryInsert): unknown[] | null {
  const id = r.id
  const partnerId = r.partner_id
  if (!id || !partnerId) return null
  const nowIso = new Date().toISOString()
  return [
    id,
    partnerId,
    r.sort_order ?? 0,
    r.sku ?? null,
    r.name ?? '',
    r.description ?? '',
    r.stock_note ?? '',
    r.stock_qty ?? 0,
    r.price_hint ?? '',
    r.image_url ?? '',
    r.product_url ?? '',
    r.product_video_url ?? '',
    r.consult_note ?? '',
    r.remarketing_id ?? '',
    r.is_active !== false,
    r.created_at ?? nowIso,
    r.updated_at ?? nowIso,
    computePriceAmountForWrite(r.price_hint),
  ]
}

/**
 * Insert một chunk (import mới). Chỉ các cột nghiệp vụ + timestamp — không đụng embedding/vision.
 * `false` = không pool, thiếu id, hoặc lỗi SQL.
 */
export async function insertPartnerInventoryChunkFromPg(
  rows: MessagingPartnerInventoryInsert[]
): Promise<boolean> {
  if (!isPgConfigured() || rows.length === 0) return false
  try {
    const params: unknown[] = []
    const valuesSql: string[] = []
    let p = 1
    for (const r of rows) {
      const rowParams = inventoryInsertRowParams(r)
      if (!rowParams) return false
      valuesSql.push(
        `($${p++}::uuid, $${p++}::uuid, $${p++}::int, $${p++}::text, $${p++}::text, $${p++}::text, $${p++}::text, $${p++}::int, $${p++}::text, $${p++}::text, $${p++}::text, $${p++}::text, $${p++}::text, $${p++}::text, $${p++}::bool, $${p++}::timestamptz, $${p++}::timestamptz, $${p++}::numeric)`
      )
      params.push(...rowParams)
    }
    await getPgPool().query(
      `insert into public.messaging_partner_inventory (
        id, partner_id, sort_order, sku, name, description, stock_note, stock_qty, price_hint,
        image_url, product_url, product_video_url, consult_note, remarketing_id, is_active, created_at, updated_at, price_amount
      ) values ${valuesSql.join(', ')}`,
      params
    )
    return true
  } catch (e) {
    console.warn('[insertPartnerInventoryChunkFromPg]', e)
    return false
  }
}

/**
 * Upsert chunk (`on conflict (id)`) — tương đương upsert REST trước đây; không ghi đè embedding nếu không gửi.
 * `false` = không pool hoặc lỗi.
 */
export async function upsertPartnerInventoryChunkFromPg(
  rows: MessagingPartnerInventoryInsert[]
): Promise<boolean> {
  if (!isPgConfigured() || rows.length === 0) return false
  try {
    const params: unknown[] = []
    const valuesSql: string[] = []
    let p = 1
    for (const r of rows) {
      const rowParams = inventoryInsertRowParams(r)
      if (!rowParams) return false
      valuesSql.push(
        `($${p++}::uuid, $${p++}::uuid, $${p++}::int, $${p++}::text, $${p++}::text, $${p++}::text, $${p++}::text, $${p++}::int, $${p++}::text, $${p++}::text, $${p++}::text, $${p++}::text, $${p++}::text, $${p++}::text, $${p++}::bool, $${p++}::timestamptz, $${p++}::timestamptz, $${p++}::numeric)`
      )
      params.push(...rowParams)
    }
    await getPgPool().query(
      `insert into public.messaging_partner_inventory (
        id, partner_id, sort_order, sku, name, description, stock_note, stock_qty, price_hint,
        image_url, product_url, product_video_url, consult_note, remarketing_id, is_active, created_at, updated_at, price_amount
      ) values ${valuesSql.join(', ')}
      on conflict (id) do update set
        partner_id = excluded.partner_id,
        sort_order = excluded.sort_order,
        sku = excluded.sku,
        name = excluded.name,
        description = excluded.description,
        stock_note = excluded.stock_note,
        stock_qty = excluded.stock_qty,
        price_hint = excluded.price_hint,
        image_url = excluded.image_url,
        product_url = excluded.product_url,
        product_video_url = excluded.product_video_url,
        consult_note = excluded.consult_note,
        remarketing_id = excluded.remarketing_id,
        is_active = excluded.is_active,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at,
        price_amount = excluded.price_amount
      where public.messaging_partner_inventory.partner_id = excluded.partner_id`,
      params
    )
    return true
  } catch (e) {
    console.warn('[upsertPartnerInventoryChunkFromPg]', e)
    return false
  }
}

export type PartnerInventoryEmbeddingStatsAgg = {
  total: number
  eligible: number
  done: number
  pending: number
  failed: number
}

/** Thống kê embedding (cùng logic vòng lặp dashboard). `null` = lỗi / không pool. */
export async function fetchPartnerInventoryEmbeddingStatsFromPg(
  partnerId: string
): Promise<PartnerInventoryEmbeddingStatsAgg | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{
      total: string | number
      eligible: string | number
      done: string | number
      pending: string | number
      failed: string | number
    }>(
      `with inv as (
         select *
         from public.messaging_partner_inventory
         where partner_id = $1::uuid
       ),
       el as (
         select *
         from inv
         where coalesce(is_active, true)
           and (
             trim(coalesce(image_url, '')) ~* '^https?://'
             or trim(coalesce(image_url, '')) like '//%'
           )
       )
       select
         (select count(*)::bigint from inv) as total,
         (select count(*)::bigint from el) as eligible,
         (select count(*)::bigint from el where image_embedding_updated_at is not null) as done,
         (select count(*)::bigint from el where image_embedding_updated_at is null) as pending,
         (select count(*)::bigint from el where trim(coalesce(image_embedding_error, '')) <> ''
           and not (
             image_embedding_json is not null
             and nullif(trim(coalesce(image_embedding_vec::text, '')), '') is not null
           )) as failed`,
      [partnerId]
    )
    if (!row) return null
    const n = (v: string | number) => Math.max(0, Math.floor(Number(v)))
    return {
      total: n(row.total),
      eligible: n(row.eligible),
      done: n(row.done),
      pending: n(row.pending),
      failed: n(row.failed),
    }
  } catch (e) {
    if (isMissingInventoryTableError(e)) {
      return { total: 0, eligible: 0, done: 0, pending: 0, failed: 0 }
    }
    console.warn('[fetchPartnerInventoryEmbeddingStatsFromPg]', e)
    return null
  }
}

export type PartnerInventoryEmbeddingErrorRow = {
  id: string
  sku: string | null
  name: string
  image_url: string
  image_embedding_error: string | null
  image_embedding_updated_at: string | null
  text_embedding_error: string | null
  text_embedding_updated_at: string | null
}

const INVENTORY_EMBEDDING_ERROR_WHERE = `coalesce(mpi.is_active, true)
  and (
    (
      trim(coalesce(mpi.image_embedding_error, '')) <> ''
      and not (
        mpi.image_embedding_json is not null
        and nullif(trim(coalesce(mpi.image_embedding_vec::text, '')), '') is not null
      )
    )
    or (
      trim(coalesce(mpi.text_embedding_error, '')) <> ''
      and not (
        mpi.text_embedding_json is not null
        and nullif(trim(coalesce(mpi.text_embedding_vec::text, '')), '') is not null
      )
    )
  )`

const INVENTORY_IMAGE_EMBED_STALE_ERROR_WHERE = `trim(coalesce(image_embedding_error, '')) <> ''
  and image_embedding_json is not null
  and nullif(trim(coalesce(image_embedding_vec::text, '')), '') is not null`

const INVENTORY_TEXT_EMBED_STALE_ERROR_WHERE = `trim(coalesce(text_embedding_error, '')) <> ''
  and text_embedding_json is not null
  and nullif(trim(coalesce(text_embedding_vec::text, '')), '') is not null`

/** Xóa lỗi embedding ảnh cũ khi vector đã có đủ — tránh đếm lỗi ảo sau retry thành công. */
export async function clearStalePartnerInventoryImageEmbeddingErrorsFromPg(
  partnerId: string
): Promise<number | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ count: string | number }>(
      `with cleared as (
         update public.messaging_partner_inventory
         set image_embedding_error = '',
             updated_at = now()
         where partner_id = $1::uuid
           and ${INVENTORY_IMAGE_EMBED_STALE_ERROR_WHERE}
         returning 1
       )
       select count(*)::bigint as count from cleared`,
      [partnerId]
    )
    return Math.max(0, Math.floor(Number(row?.count ?? 0)))
  } catch (e) {
    if (isMissingInventoryTableError(e)) return 0
    console.warn('[clearStalePartnerInventoryImageEmbeddingErrorsFromPg]', e)
    return null
  }
}

/** Xóa lỗi embedding văn bản cũ khi vector đã có đủ. */
export async function clearStalePartnerInventoryTextEmbeddingErrorsFromPg(
  partnerId: string
): Promise<number | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ count: string | number }>(
      `with cleared as (
         update public.messaging_partner_inventory
         set text_embedding_error = '',
             updated_at = now()
         where partner_id = $1::uuid
           and ${INVENTORY_TEXT_EMBED_STALE_ERROR_WHERE}
         returning 1
       )
       select count(*)::bigint as count from cleared`,
      [partnerId]
    )
    return Math.max(0, Math.floor(Number(row?.count ?? 0)))
  } catch (e) {
    if (isMissingInventoryTableError(e)) return 0
    console.warn('[clearStalePartnerInventoryTextEmbeddingErrorsFromPg]', e)
    return null
  }
}

function mapPartnerInventoryEmbeddingErrorRow(r: {
  id: string
  sku: string | null
  name: string
  image_url: string
  image_embedding_error: string | null
  image_embedding_updated_at: string | null
  text_embedding_error: string | null
  text_embedding_updated_at: string | null
}): PartnerInventoryEmbeddingErrorRow {
  return {
    id: r.id,
    sku: r.sku,
    name: r.name ?? '',
    image_url: r.image_url ?? '',
    image_embedding_error: r.image_embedding_error,
    image_embedding_updated_at: r.image_embedding_updated_at,
    text_embedding_error: r.text_embedding_error,
    text_embedding_updated_at: r.text_embedding_updated_at,
  }
}

/** Số sản phẩm active có ít nhất một lỗi vector ảnh hoặc văn bản. */
export async function fetchPartnerInventoryEmbeddingErrorCountFromPg(
  partnerId: string
): Promise<number | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ count: string | number }>(
      `select count(*)::bigint as count
       from public.messaging_partner_inventory mpi
       where mpi.partner_id = $1::uuid
         and ${INVENTORY_EMBEDDING_ERROR_WHERE}`,
      [partnerId]
    )
    if (!row) return 0
    return Math.max(0, Math.floor(Number(row.count)))
  } catch (e) {
    if (isMissingInventoryTableError(e)) return 0
    console.warn('[fetchPartnerInventoryEmbeddingErrorCountFromPg]', e)
    return null
  }
}

/** Trang danh sách lỗi vector — mới nhất trước. */
export async function fetchPartnerInventoryEmbeddingErrorsPageFromPg(
  partnerId: string,
  offset: number,
  limit: number
): Promise<PartnerInventoryEmbeddingErrorRow[] | null> {
  if (!isPgConfigured()) return null
  const lim = Math.max(1, Math.min(500, Math.floor(limit)))
  const off = Math.max(0, Math.floor(offset))
  try {
    const rows = await pgQuery<{
      id: string
      sku: string | null
      name: string
      image_url: string
      image_embedding_error: string | null
      image_embedding_updated_at: string | null
      text_embedding_error: string | null
      text_embedding_updated_at: string | null
    }>(
      `select
         mpi.id::text as id,
         mpi.sku,
         coalesce(mpi.name, '') as name,
         coalesce(mpi.image_url, '') as image_url,
         nullif(trim(coalesce(mpi.image_embedding_error, '')), '') as image_embedding_error,
         mpi.image_embedding_updated_at::text as image_embedding_updated_at,
         nullif(trim(coalesce(mpi.text_embedding_error, '')), '') as text_embedding_error,
         mpi.text_embedding_updated_at::text as text_embedding_updated_at
       from public.messaging_partner_inventory mpi
       where mpi.partner_id = $1::uuid
         and ${INVENTORY_EMBEDDING_ERROR_WHERE}
       order by greatest(
         coalesce(mpi.image_embedding_updated_at, '1970-01-01'::timestamptz),
         coalesce(mpi.text_embedding_updated_at, '1970-01-01'::timestamptz)
       ) desc,
       mpi.id asc
       limit $2 offset $3`,
      [partnerId, lim, off]
    )
    return rows.map(mapPartnerInventoryEmbeddingErrorRow)
  } catch (e) {
    if (isMissingInventoryTableError(e)) return []
    console.warn('[fetchPartnerInventoryEmbeddingErrorsPageFromPg]', e)
    return null
  }
}

/** Toàn bộ lỗi vector để export CSV (giới hạn an toàn). */
export async function fetchPartnerInventoryEmbeddingErrorsAllFromPg(
  partnerId: string,
  maxRows = 15000
): Promise<PartnerInventoryEmbeddingErrorRow[] | null> {
  if (!isPgConfigured()) return null
  const cap = Math.max(1, Math.min(50000, Math.floor(maxRows)))
  try {
    const rows = await pgQuery<{
      id: string
      sku: string | null
      name: string
      image_url: string
      image_embedding_error: string | null
      image_embedding_updated_at: string | null
      text_embedding_error: string | null
      text_embedding_updated_at: string | null
    }>(
      `select
         mpi.id::text as id,
         mpi.sku,
         coalesce(mpi.name, '') as name,
         coalesce(mpi.image_url, '') as image_url,
         nullif(trim(coalesce(mpi.image_embedding_error, '')), '') as image_embedding_error,
         mpi.image_embedding_updated_at::text as image_embedding_updated_at,
         nullif(trim(coalesce(mpi.text_embedding_error, '')), '') as text_embedding_error,
         mpi.text_embedding_updated_at::text as text_embedding_updated_at
       from public.messaging_partner_inventory mpi
       where mpi.partner_id = $1::uuid
         and ${INVENTORY_EMBEDDING_ERROR_WHERE}
       order by greatest(
         coalesce(mpi.image_embedding_updated_at, '1970-01-01'::timestamptz),
         coalesce(mpi.text_embedding_updated_at, '1970-01-01'::timestamptz)
       ) desc,
       mpi.id asc
       limit $2`,
      [partnerId, cap]
    )
    return rows.map(mapPartnerInventoryEmbeddingErrorRow)
  } catch (e) {
    if (isMissingInventoryTableError(e)) return []
    console.warn('[fetchPartnerInventoryEmbeddingErrorsAllFromPg]', e)
    return null
  }
}

/**
 * Thống kê embedding văn bản (tên + giá + ghi chú tư vấn). `eligible` = dòng active có ít nhất một trường để embed.
 */
export async function fetchPartnerInventoryTextEmbeddingStatsFromPg(
  partnerId: string
): Promise<PartnerInventoryEmbeddingStatsAgg | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{
      total: string | number
      eligible: string | number
      done: string | number
      pending: string | number
      failed: string | number
    }>(
      `with inv as (
         select *
         from public.messaging_partner_inventory
         where partner_id = $1::uuid
       ),
       el as (
         select *
         from inv
         where coalesce(is_active, true)
           and (
             trim(coalesce(name, '')) <> ''
             or trim(coalesce(price_hint, '')) <> ''
             or trim(coalesce(consult_note, '')) <> ''
           )
       )
       select
         (select count(*)::bigint from inv) as total,
         (select count(*)::bigint from el) as eligible,
         (select count(*)::bigint from el where text_embedding_updated_at is not null) as done,
         (select count(*)::bigint from el where text_embedding_updated_at is null) as pending,
         (select count(*)::bigint from el where trim(coalesce(text_embedding_error, '')) <> ''
           and not (
             text_embedding_json is not null
             and nullif(trim(coalesce(text_embedding_vec::text, '')), '') is not null
           )) as failed`,
      [partnerId]
    )
    if (!row) return null
    const n = (v: string | number) => Math.max(0, Math.floor(Number(v)))
    return {
      total: n(row.total),
      eligible: n(row.eligible),
      done: n(row.done),
      pending: n(row.pending),
      failed: n(row.failed),
    }
  } catch (e) {
    if (isMissingInventoryTableError(e)) {
      return { total: 0, eligible: 0, done: 0, pending: 0, failed: 0 }
    }
    console.warn('[fetchPartnerInventoryTextEmbeddingStatsFromPg]', e)
    return null
  }
}

/** Ghi chất liệu suy từ ảnh / shop — dùng lại cho lượt hỏi sau. */
export async function updatePartnerInventoryMaterialNoteFromPg(
  partnerId: string,
  inventoryId: string,
  materialNote: string
): Promise<boolean> {
  if (!isPgConfigured()) return false
  const note = String(materialNote ?? '').trim().slice(0, 2000)
  if (!note) return false
  try {
    const r = await getPgPool().query(
      `update public.messaging_partner_inventory
       set material_note = $3,
           updated_at = now()
       where partner_id = $1::uuid and id = $2::uuid`,
      [partnerId, inventoryId, note]
    )
    return (r.rowCount ?? 0) > 0
  } catch (e) {
    console.warn('[updatePartnerInventoryMaterialNoteFromPg]', e)
    return false
  }
}

/** URL ảnh collage chi tiết chất liệu (public HTTPS) — cache theo mặt hàng. */
export async function updatePartnerInventoryMaterialDetailImageUrlFromPg(
  partnerId: string,
  inventoryId: string,
  materialDetailImageUrl: string
): Promise<boolean> {
  if (!isPgConfigured()) return false
  const u = String(materialDetailImageUrl ?? '').trim().slice(0, 2000)
  if (!u || !/^https?:\/\//i.test(u)) return false
  try {
    const r = await getPgPool().query(
      `update public.messaging_partner_inventory
       set material_detail_image_url = $3,
           updated_at = now()
       where partner_id = $1::uuid and id = $2::uuid`,
      [partnerId, inventoryId, u]
    )
    return (r.rowCount ?? 0) > 0
  } catch (e) {
    console.warn('[updatePartnerInventoryMaterialDetailImageUrlFromPg]', e)
    return false
  }
}

/** Ảnh minh họa khách dùng/mặc sản phẩm (public HTTPS) — cache theo mặt hàng; slot 1 hoặc 2. */
export async function updatePartnerInventoryRealUseImageUrlAtSlotFromPg(
  partnerId: string,
  inventoryId: string,
  realUseImageUrl: string,
  slot: 1 | 2
): Promise<boolean> {
  if (!isPgConfigured()) return false
  const u = String(realUseImageUrl ?? '').trim().slice(0, 2000)
  if (!u || !/^https?:\/\//i.test(u)) return false
  const col = slot === 1 ? 'real_use_image_url' : 'real_use_image_url_2'
  try {
    const r = await getPgPool().query(
      `update public.messaging_partner_inventory
       set ${col} = $3,
           updated_at = now()
       where partner_id = $1::uuid and id = $2::uuid`,
      [partnerId, inventoryId, u]
    )
    return (r.rowCount ?? 0) > 0
  } catch (e) {
    console.warn('[updatePartnerInventoryRealUseImageUrlAtSlotFromPg]', e)
    return false
  }
}

export async function updatePartnerInventoryRealUseImageUrlFromPg(
  partnerId: string,
  inventoryId: string,
  realUseImageUrl: string
): Promise<boolean> {
  return updatePartnerInventoryRealUseImageUrlAtSlotFromPg(partnerId, inventoryId, realUseImageUrl, 1)
}

export async function updatePartnerInventoryDashboardItemFromPg(
  partnerId: string,
  itemId: string,
  fields: {
    name: string
    sku: string | null
    description: string
    stock_note: string
    stock_qty: number
    price_hint: string
    image_url: string
    product_url: string
    product_video_url: string
    consult_note: string
    material_note: string
    material_detail_image_url: string
    real_use_image_url: string
    real_use_image_url_2: string
    remarketing_id: string | null
    sort_order: number
    updated_at: string
    sale_price_amount?: number | null
    sale_starts_at?: string | null
    sale_ends_at?: string | null
  }
): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const r = await getPgPool().query(
      `update public.messaging_partner_inventory set
        name = $3,
        sku = $4,
        description = $5,
        stock_note = $6,
        stock_qty = $7,
        price_hint = $8,
        image_url = $9,
        product_url = $10,
        product_video_url = $11,
        consult_note = $12,
        material_note = $13,
        material_detail_image_url = $14,
        real_use_image_url = $15,
        real_use_image_url_2 = $16,
        remarketing_id = $17,
        sort_order = $18,
        is_active = true,
        price_amount = $20::numeric,
        sale_price_amount = $21::numeric,
        sale_starts_at = $22::timestamptz,
        sale_ends_at = $23::timestamptz,
        updated_at = $19::timestamptz
       where partner_id = $1::uuid and id = $2::uuid`,
      [
        partnerId,
        itemId,
        fields.name,
        fields.sku,
        fields.description,
        fields.stock_note,
        fields.stock_qty,
        fields.price_hint,
        fields.image_url,
        fields.product_url,
        fields.product_video_url,
        fields.consult_note,
        fields.material_note,
        fields.material_detail_image_url,
        fields.real_use_image_url,
        fields.real_use_image_url_2,
        fields.remarketing_id,
        fields.sort_order,
        fields.updated_at,
        computePriceAmountForWrite(fields.price_hint),
        fields.sale_price_amount == null ? null : Math.max(0, Number(fields.sale_price_amount)),
        fields.sale_starts_at || null,
        fields.sale_ends_at || null,
      ]
    )
    return (r.rowCount ?? 0) > 0
  } catch (e) {
    console.warn('[updatePartnerInventoryDashboardItemFromPg]', e)
    return false
  }
}

export async function insertPartnerInventoryDashboardItemFromPg(
  partnerId: string,
  fields: {
    name: string
    sku: string | null
    description: string
    stock_note: string
    stock_qty: number
    price_hint: string
    image_url: string
    product_url: string
    product_video_url: string
    consult_note: string
    material_note: string
    material_detail_image_url: string
    real_use_image_url: string
    real_use_image_url_2: string
    remarketing_id: string | null
    sort_order: number
    created_at: string
    updated_at: string
  }
): Promise<string | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ id: string }>(
      `insert into public.messaging_partner_inventory (
        partner_id, name, sku, description, stock_note, stock_qty, price_hint, image_url, product_url, product_video_url, consult_note,
        material_note, material_detail_image_url, real_use_image_url, real_use_image_url_2, remarketing_id,
        sort_order, is_active, price_amount, created_at, updated_at
      ) values (
        $1::uuid, $2, $3, $4, $5, $6::int, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, true, $20::numeric, $18::timestamptz, $19::timestamptz
      )
      returning id::text as id`,
      [
        partnerId,
        fields.name,
        fields.sku,
        fields.description,
        fields.stock_note,
        fields.stock_qty,
        fields.price_hint,
        fields.image_url,
        fields.product_url,
        fields.product_video_url,
        fields.consult_note,
        fields.material_note,
        fields.material_detail_image_url,
        fields.real_use_image_url,
        fields.real_use_image_url_2,
        fields.remarketing_id,
        fields.sort_order,
        fields.created_at,
        fields.updated_at,
        computePriceAmountForWrite(fields.price_hint),
      ]
    )
    return row?.id ?? null
  } catch (e) {
    console.warn('[insertPartnerInventoryDashboardItemFromPg]', e)
    return null
  }
}

/**
 * PS.9 — tạo dòng kho từ Product Studio (thủ công hoặc AI). Khác `insertPartnerInventoryDashboardItemFromPg`:
 * dùng cột structured `colors_json`/`sizes_json` làm nguồn thật (không giấu trong `description`/`stock_note`
 * như quy ước cũ) — `description` giữ đúng vai trò mô tả sản phẩm thật, `stock_note` để trống.
 */
export async function insertPartnerInventoryFromProductStudioFromPg(
  partnerId: string,
  fields: {
    name: string
    description: string
    priceAmount: number
    colors: { name: string; img: string }[]
    sizes: string[]
    mainImage: string
    galleryUrls: string[]
    detailImageUrls: string[]
    material: string
    /** Ảnh collage chất liệu (Studio) — cột `material_detail_image_url`, tách khỏi gallery/chi tiết như 188. */
    materialDetailImageUrl?: string | null
    stockQty: number
    origin: 'manual' | 'manual_ai'
    productStudioJobId: string | null
    productStudioMeta: Record<string, unknown> | null
  }
): Promise<string | null> {
  if (!isPgConfigured()) return null
  try {
    const now = new Date().toISOString()
    const priceHint = formatVndForInventoryWrite(fields.priceAmount)
    const nextSortOrderRow = await pgQueryOne<{ next: number }>(
      `select coalesce(max(sort_order), 0) + 1 as next from public.messaging_partner_inventory where partner_id = $1::uuid`,
      [partnerId]
    )
    const sortOrder = nextSortOrderRow?.next ?? 0
    const row = await pgQueryOne<{ id: string }>(
      `insert into public.messaging_partner_inventory (
         partner_id, name, description, stock_note, stock_qty, price_hint, image_url, material_note,
         material_detail_image_url,
         sort_order, is_active, price_amount, colors_json, sizes_json, gallery_urls, detail_image_urls,
         product_studio_meta, origin, product_studio_job_id, created_at, updated_at
       ) values (
         $1::uuid, $2, $3, '', $4::int, $5, $6, $7, $8,
         $9::int, true, $10::numeric, $11::jsonb, $12::jsonb, $13::jsonb, $14::jsonb,
         $15::jsonb, $16, $17::uuid, $18::timestamptz, $18::timestamptz
       )
       returning id::text as id`,
      [
        partnerId,
        fields.name.trim().slice(0, 500),
        fields.description.trim(),
        Math.max(0, Math.round(fields.stockQty)),
        priceHint,
        fields.mainImage.trim(),
        fields.material.trim().slice(0, 2000),
        (fields.materialDetailImageUrl || '').trim() || null,
        sortOrder,
        fields.priceAmount > 0 ? fields.priceAmount : null,
        JSON.stringify(fields.colors),
        JSON.stringify(fields.sizes),
        JSON.stringify(fields.galleryUrls),
        JSON.stringify(fields.detailImageUrls),
        fields.productStudioMeta ? JSON.stringify(fields.productStudioMeta) : null,
        fields.origin,
        fields.productStudioJobId,
        now,
      ]
    )
    return row?.id ?? null
  } catch (e) {
    console.error('[insertPartnerInventoryFromProductStudioFromPg]', e)
    return null
  }
}

function formatVndForInventoryWrite(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return ''
  return `${new Intl.NumberFormat('vi-VN').format(Math.round(amount))}đ`
}

export async function deletePartnerInventoryItemForPartnerFromPg(
  partnerId: string,
  itemId: string
): Promise<boolean> {
  return deletePartnerInventoryByIdsForPartnerFromPg(partnerId, [itemId])
}

/**
 * Các dòng kho đang active, `updated_at` mới nhất trước — dùng cron embed để ưu tiên partner vừa cập nhật.
 */
export async function fetchActivePartnerInventoryScanRowsFromPg(
  limit: number
): Promise<Array<{ partner_id: string; updated_at: string }> | null> {
  if (!isPgConfigured()) return null
  const cap = Math.max(1, Math.min(100_000, limit))
  try {
    const rows = await pgQuery<{ partner_id: string; updated_at: unknown }>(
      `select partner_id::text, updated_at
       from public.messaging_partner_inventory
       where coalesce(is_active, true) = true
       order by updated_at desc
       limit $1::int`,
      [cap]
    )
    return rows.map((r) => ({
      partner_id: r.partner_id,
      updated_at: tsIsoReq(r.updated_at),
    }))
  } catch (e) {
    console.error('[messaging-partner-inventory-pg] fetchActivePartnerInventoryScanRowsFromPg', e)
    return null
  }
}
