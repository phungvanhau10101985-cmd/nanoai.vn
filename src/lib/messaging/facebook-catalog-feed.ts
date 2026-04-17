/**
 * CSV feed tương thích Meta Commerce Manager (danh mục sản phẩm / Facebook).
 * @see https://developers.facebook.com/docs/commerce-platform/catalog/fields
 */

import type { Database } from '@/types/database.types'
import { buildGuestConsultChatAbsoluteUrl } from '@/lib/messaging/build-guest-consult-chat-link'

type InventoryRow = Database['public']['Tables']['messaging_partner_inventory']['Row']

/** Cột tối thiểu Meta thường yêu cầu cho data feed. */
export const FACEBOOK_CATALOG_CSV_HEADERS = [
  'id',
  'title',
  'description',
  'availability',
  'condition',
  'price',
  'link',
  'image_link',
  'brand',
  'additional_image_link',
] as const

function csvEscapeCell(value: string): string {
  const s = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function trimMax(s: string, max: number): string {
  const t = s.trim()
  if (t.length <= max) return t
  return t.slice(0, max)
}

/** Meta chấp nhận http/https cho image_link / link. */
function isAbsoluteHttpUrl(u: string): boolean {
  return /^https?:\/\//i.test(u.trim())
}

/** Lấy số nguyên VND từ chuỗi giá tự do (vd: "1.299.000 ₫"). */
export function parseVndIntegerFromPriceHint(raw: string): number | null {
  const t = String(raw ?? '').trim()
  if (!t) return null
  const digits = t.replace(/\D/g, '')
  if (!digits) return null
  const n = Number.parseInt(digits, 10)
  if (!Number.isFinite(n) || n < 0) return null
  if (n === 0) return null
  return n
}

function formatMetaPriceVnd(amount: number): string {
  return `${Math.round(amount)} VND`
}

/** Luôn dùng trang tư vấn trên NanoAI (`/messaging/p/.../tu-van/...` hoặc `?ctx_*`), không dùng link web shop. */
function pickConsultLink(origin: string, slug: string, row: InventoryRow): string | null {
  const consult = buildGuestConsultChatAbsoluteUrl(origin, slug, {
    id: row.id,
    image_url: row.image_url,
    product_url: row.product_url,
    sku: row.sku,
  })
  return isAbsoluteHttpUrl(consult) ? consult : null
}

function pickAdditionalImage(row: InventoryRow): string {
  for (const u of [row.material_detail_image_url, row.real_use_image_url, row.real_use_image_url_2]) {
    const s = (u ?? '').trim()
    if (isAbsoluteHttpUrl(s)) return s
  }
  return ''
}

/**
 * Một dòng CSV hoặc null nếu thiếu trường bắt buộc (ảnh, link, giá hợp lệ).
 */
function rowToCsvLine(
  row: InventoryRow,
  ctx: { origin: string; slug: string; brand: string }
): string | null {
  if (row.is_active === false) return null

  const title = trimMax(row.name || 'Sản phẩm', 200)
  const description = trimMax(
    [row.description, row.consult_note, row.stock_note].filter(Boolean).join(' — ') || title,
    9990
  )

  const image = (row.image_url ?? '').trim()
  if (!isAbsoluteHttpUrl(image)) return null

  const link = pickConsultLink(ctx.origin, ctx.slug, row)
  if (!link) return null

  const priceNum = parseVndIntegerFromPriceHint(row.price_hint)
  if (priceNum == null) return null

  const idRaw = (row.remarketing_id ?? '').trim() || row.id
  const id = trimMax(idRaw.replace(/[\s\r\n]+/g, ' ').trim(), 100)

  /** `null` = không quản lý tồn — coi như còn bán; chỉ `0` (hoặc âm) là hết. */
  const qty = row.stock_qty
  const availability =
    qty != null && qty <= 0 ? 'out of stock' : 'in stock'

  const additional = pickAdditionalImage(row)

  const cells = [
    id,
    title,
    description,
    availability,
    'new',
    formatMetaPriceVnd(priceNum),
    link,
    image,
    trimMax(ctx.brand || 'Shop', 100),
    additional,
  ].map(csvEscapeCell)

  return cells.join(',')
}

/**
 * UTF-8 BOM giúp Excel/Google Trang tính nhận UTF-8 khi tải file.
 */
export function buildFacebookCatalogFeedCsv(
  rows: InventoryRow[],
  ctx: { origin: string; slug: string; brand: string }
): Buffer {
  const header = FACEBOOK_CATALOG_CSV_HEADERS.join(',')
  const lines: string[] = [header]
  for (const row of rows) {
    const line = rowToCsvLine(row, ctx)
    if (line) lines.push(line)
  }
  const body = `${lines.join('\r\n')}\r\n`
  return Buffer.from(`\ufeff${body}`, 'utf8')
}
