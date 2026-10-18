/**
 * Nguồn cấp dữ liệu tính năng NanoAI cho TikTok Catalog và Google Merchant Center.
 * Cùng `id` với Facebook CSV và content_id remarketing (`feature_*`).
 *
 * Google Shopping (product data spec):
 * id, title, description, link, image_link, availability, price, brand,
 * condition, identifier_exists, google_product_category, shipping.
 * Phần mềm không có GTIN → identifier_exists = no, không gửi gtin/mpn.
 * Danh mục Google 313 = Software.
 * @see https://support.google.com/merchants/answer/7052112
 */

import { rewriteLegacyBunnyCdnUrl } from '@/lib/bunny-cdn-url'
import {
  getNanoAiCatalogVersionToken,
  listNanoAiFacebookCatalogItems,
  type NanoAiFacebookCatalogItem,
} from '@/lib/catalog/nanoai-facebook-catalog'

/** Google product taxonomy: Software. */
export const NANOAI_GOOGLE_PRODUCT_CATEGORY = '313'

/** Digital goods: no parcel. Country Vietnam, price 0. */
export const NANOAI_GOOGLE_SHIPPING = 'VN:::0.00 VND'

export const NANOAI_GOOGLE_MERCHANT_HEADERS = [
  'id',
  'title',
  'description',
  'link',
  'mobile_link',
  'image_link',
  'availability',
  'price',
  'brand',
  'condition',
  'identifier_exists',
  'google_product_category',
  'product_type',
  'shipping',
  'adult',
] as const

export const NANOAI_TIKTOK_CATALOG_HEADERS = [
  'sku_id',
  'title',
  'description',
  'availability',
  'condition',
  'price',
  'link',
  'image_link',
  'brand',
  'google_product_category',
  'product_type',
] as const

function toAbsoluteUrl(origin: string, path: string): string {
  const rewritten = rewriteLegacyBunnyCdnUrl(String(path || '').trim())
  if (/^https?:\/\//i.test(rewritten)) return rewritten
  const base = origin.replace(/\/$/, '')
  const p = rewritten.startsWith('/') ? rewritten : `/${rewritten}`
  return `${base}${p}`
}

function withVersionQuery(url: string, token: string): string {
  const t = String(token || '').trim()
  if (!t) return url
  try {
    const u = new URL(url)
    u.searchParams.set('v', t)
    return u.toString()
  } catch {
    return url
  }
}

function clip(value: string, max: number): string {
  const s = value.replace(/\s+/g, ' ').trim()
  return s.length <= max ? s : s.slice(0, max).trim()
}

function imageLink(origin: string, item: NanoAiFacebookCatalogItem): string {
  return withVersionQuery(toAbsoluteUrl(origin, item.imagePath), getNanoAiCatalogVersionToken())
}

function landingLink(origin: string, item: NanoAiFacebookCatalogItem): string {
  return toAbsoluteUrl(origin, item.linkPath)
}

/** Google price: amount with two decimals + ISO 4217. */
export function formatGoogleMerchantPriceVnd(v: number): string {
  const n = Math.max(0, Math.round(v))
  return `${n}.00 VND`
}

function formatPlainPriceVnd(v: number): string {
  return `${Math.max(0, Math.round(v))} VND`
}

function tsvCell(value: string): string {
  return value.replace(/[\t\r\n]/g, ' ')
}

function csvCell(value: string): string {
  const s = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function googleAvailability(item: NanoAiFacebookCatalogItem): 'in_stock' | 'out_of_stock' {
  return item.availability === 'in stock' ? 'in_stock' : 'out_of_stock'
}

export function buildNanoAiGoogleMerchantFeedTsv(origin: string): Buffer {
  const lines = [NANOAI_GOOGLE_MERCHANT_HEADERS.join('\t')]
  for (const item of listNanoAiFacebookCatalogItems()) {
    const link = landingLink(origin, item)
    const cells = [
      clip(item.id, 50),
      clip(item.title, 150),
      clip(item.description, 5000),
      link,
      link,
      imageLink(origin, item),
      googleAvailability(item),
      formatGoogleMerchantPriceVnd(item.priceVnd),
      clip(item.brand, 70),
      item.condition,
      'no',
      NANOAI_GOOGLE_PRODUCT_CATEGORY,
      clip(item.productType, 750),
      NANOAI_GOOGLE_SHIPPING,
      'no',
    ]
    lines.push(cells.map(tsvCell).join('\t'))
  }
  return Buffer.from(`${lines.join('\n')}\n`, 'utf8')
}

export function buildNanoAiTikTokCatalogFeedCsv(origin: string): Buffer {
  const rows = listNanoAiFacebookCatalogItems().map((item) => [
    item.id,
    clip(item.title, 150),
    clip(item.description, 5000),
    item.availability,
    item.condition,
    formatPlainPriceVnd(item.priceVnd),
    landingLink(origin, item),
    imageLink(origin, item),
    item.brand,
    NANOAI_GOOGLE_PRODUCT_CATEGORY,
    clip(item.productType, 750),
  ])
  const csv = [NANOAI_TIKTOK_CATALOG_HEADERS, ...rows]
    .map((line) => line.map((cell) => csvCell(String(cell))).join(','))
    .join('\r\n')
  return Buffer.from(`\ufeff${csv}\r\n`, 'utf8')
}
