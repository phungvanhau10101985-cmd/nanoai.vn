/**
 * Helper chung cho feed danh mục Meta / Google Merchant Center / TikTok.
 * Cột `id` = remarketing_id (nếu có) hoặc inventory.id — cùng định danh với feed Facebook.
 */

import type { Database } from '@/types/database.types'
import { buildGuestConsultChatAbsoluteUrl } from '@/lib/messaging/build-guest-consult-chat-link'
import { parseVndIntegerFromPriceHint } from '@/lib/messaging/facebook-catalog-feed'
import { partnerSiteProductPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import { inventoryShopDisplayDescription } from '@/lib/partner-website/shop/inventory-to-shop-product'

export type CatalogFeedInventoryRow = Database['public']['Tables']['messaging_partner_inventory']['Row']

export type CatalogFeedShopLanding = {
  siteSlug: string
  origin: string
  customDomain: boolean
}

export function isAbsoluteHttpUrl(u: string): boolean {
  return /^https?:\/\//i.test(u.trim())
}

export function catalogFeedTrimMax(s: string, max: number): string {
  const t = s.trim()
  if (t.length <= max) return t
  return t.slice(0, max)
}

export function catalogFeedItemId(row: Pick<CatalogFeedInventoryRow, 'id' | 'remarketing_id'>): string {
  const idRaw = (row.remarketing_id ?? '').trim() || row.id
  return catalogFeedTrimMax(idRaw.replace(/[\s\r\n]+/g, ' ').trim(), 100)
}

export function catalogFeedTitle(row: Pick<CatalogFeedInventoryRow, 'name'>, max = 200): string {
  return catalogFeedTrimMax(row.name || 'Sản phẩm', max)
}

export function catalogFeedDescription(
  row: Pick<CatalogFeedInventoryRow, 'description' | 'consult_note' | 'stock_note' | 'name'>,
  max: number
): string {
  const fromShop = inventoryShopDisplayDescription(row)
  const fallback = [row.description, row.consult_note, row.stock_note].filter(Boolean).join(' — ')
  return catalogFeedTrimMax(fromShop || fallback || catalogFeedTitle(row), max)
}

export function catalogFeedImageUrl(row: Pick<CatalogFeedInventoryRow, 'image_url'>): string | null {
  const image = (row.image_url ?? '').trim()
  return isAbsoluteHttpUrl(image) ? image : null
}

export function catalogFeedAdditionalImages(
  row: Pick<
    CatalogFeedInventoryRow,
    'image_url' | 'material_detail_image_url' | 'real_use_image_url' | 'real_use_image_url_2' | 'gallery_urls'
  >,
  max = 10
): string[] {
  const primary = (row.image_url ?? '').trim()
  const seen = new Set<string>(primary && isAbsoluteHttpUrl(primary) ? [primary] : [])
  const out: string[] = []
  const extras = [
    row.material_detail_image_url,
    row.real_use_image_url,
    row.real_use_image_url_2,
    ...(Array.isArray(row.gallery_urls) ? row.gallery_urls : []),
  ]
  for (const raw of extras) {
    const s = (raw ?? '').trim()
    if (!isAbsoluteHttpUrl(s) || seen.has(s)) continue
    seen.add(s)
    out.push(s)
    if (out.length >= max) break
  }
  return out
}

export function catalogFeedIsInStock(row: Pick<CatalogFeedInventoryRow, 'stock_qty'>): boolean {
  const qty = row.stock_qty
  return !(qty != null && qty <= 0)
}

export function catalogFeedPriceAmount(
  row: Pick<CatalogFeedInventoryRow, 'price_amount' | 'price_hint'>
): number | null {
  const fromAmount = row.price_amount != null ? Number(row.price_amount) : NaN
  if (Number.isFinite(fromAmount) && fromAmount > 0) return Math.round(fromAmount)
  return parseVndIntegerFromPriceHint(row.price_hint)
}

export function catalogFeedSalePriceAmount(
  row: Pick<CatalogFeedInventoryRow, 'sale_price_amount'>,
  regular: number
): number | null {
  const sale = row.sale_price_amount != null ? Number(row.sale_price_amount) : NaN
  if (!Number.isFinite(sale) || sale <= 0 || sale >= regular) return null
  return Math.round(sale)
}

export function catalogFeedCurrency(row: Pick<CatalogFeedInventoryRow, 'price_currency'>, fallback = 'VND'): string {
  const c = String(row.price_currency ?? fallback).trim().toUpperCase()
  return /^[A-Z]{3}$/.test(c) ? c : fallback
}

export function formatCatalogFeedPrice(amount: number, currency: string): string {
  return `${Math.round(amount)} ${currency}`
}

export function catalogFeedSku(row: Pick<CatalogFeedInventoryRow, 'sku'>): string {
  return catalogFeedTrimMax((row.sku ?? '').trim(), 70)
}

export function pickConsultProductLink(
  origin: string,
  partnerSlug: string,
  row: Pick<CatalogFeedInventoryRow, 'id' | 'image_url' | 'product_url' | 'sku'>
): string | null {
  const consult = buildGuestConsultChatAbsoluteUrl(origin, partnerSlug, {
    id: row.id,
    image_url: row.image_url,
    product_url: row.product_url,
    sku: row.sku,
  })
  return isAbsoluteHttpUrl(consult) ? consult : null
}

/** Ưu tiên PDP shop đã publish (domain riêng nếu có); không thì trang tư vấn. */
export function pickCatalogProductLandingLink(
  row: Pick<CatalogFeedInventoryRow, 'id' | 'name' | 'image_url' | 'product_url' | 'sku'>,
  ctx: { platformOrigin: string; partnerSlug: string; shop: CatalogFeedShopLanding | null }
): string | null {
  if (ctx.shop) {
    const path = partnerSiteProductPath(ctx.shop.siteSlug, row.id, {
      name: row.name,
      customDomain: ctx.shop.customDomain,
    })
    const url = `${ctx.shop.origin.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`
    if (isAbsoluteHttpUrl(url)) return url
  }
  const productUrl = (row.product_url ?? '').trim()
  if (isAbsoluteHttpUrl(productUrl)) return productUrl
  return pickConsultProductLink(ctx.platformOrigin, ctx.partnerSlug, row)
}

export function csvEscapeCell(value: string): string {
  const s = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function tsvEscapeCell(value: string): string {
  const s = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (/["\t\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function catalogFeedUtf8Csv(lines: string[]): Buffer {
  const body = `${lines.join('\r\n')}\r\n`
  return Buffer.from(`\ufeff${body}`, 'utf8')
}

export function catalogFeedUtf8Tsv(lines: string[]): Buffer {
  const body = `${lines.join('\n')}\n`
  return Buffer.from(body, 'utf8')
}
