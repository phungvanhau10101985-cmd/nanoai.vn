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
  nanoAiFeatureCatalogAdCells,
  type NanoAiFacebookCatalogItem,
} from '@/lib/catalog/nanoai-facebook-catalog'
import { GOOGLE_MERCHANT_TSV_HEADERS } from '@/lib/messaging/google-merchant-catalog-feed'
import { TIKTOK_CATALOG_CSV_HEADERS } from '@/lib/messaging/tiktok-catalog-feed'

/** Google product taxonomy: Software. */
export const NANOAI_GOOGLE_PRODUCT_CATEGORY = '313'

/** Digital goods: no parcel. Country Vietnam, price 0. */
export const NANOAI_GOOGLE_SHIPPING = 'VN:::0.00 VND'

/** Cột Google Merchant của shop, cộng shipping và adult cho hàng số. */
export const NANOAI_GOOGLE_MERCHANT_HEADERS = [
  ...GOOGLE_MERCHANT_TSV_HEADERS,
  'shipping',
  'adult',
] as const

/** Cùng cột TikTok Catalog với feed shop. */
export const NANOAI_TIKTOK_CATALOG_HEADERS = TIKTOK_CATALOG_CSV_HEADERS

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

function googleCells(origin: string, item: NanoAiFacebookCatalogItem): Record<string, string> {
  const link = landingLink(origin, item)
  const ad = nanoAiFeatureCatalogAdCells(item)
  return {
    id: clip(item.id, 50),
    title: clip(item.title, 150),
    description: clip(item.description, 5000),
    link,
    mobile_link: link,
    image_link: imageLink(origin, item),
    additional_image_link: ad.additional_image_link,
    availability: googleAvailability(item),
    price: formatGoogleMerchantPriceVnd(item.priceVnd),
    custom_label_0: ad.custom_label_0,
    custom_label_1: ad.custom_label_1,
    custom_label_2: ad.custom_label_2,
    custom_label_3: ad.custom_label_3,
    custom_label_4: ad.custom_label_4,
    sale_price: ad.sale_price,
    sale_price_effective_date: ad.sale_price_effective_date,
    cost_of_goods_sold: ad.cost_of_goods_sold,
    auto_pricing_min_price: ad.auto_pricing_min_price,
    brand: clip(item.brand, 70),
    condition: item.condition,
    identifier_exists: 'no',
    gtin: ad.gtin,
    mpn: ad.mpn,
    google_product_category: NANOAI_GOOGLE_PRODUCT_CATEGORY,
    product_type: clip(item.productType, 750),
    gender: ad.gender,
    age_group: ad.age_group,
    color: ad.color,
    size: ad.size,
    material: ad.material,
    shipping_weight: ad.shipping_weight,
    item_group_id: ad.item_group_id,
    video: ad.video,
    shipping: NANOAI_GOOGLE_SHIPPING,
    adult: 'no',
  }
}

function tiktokCells(origin: string, item: NanoAiFacebookCatalogItem): Record<string, string> {
  const ad = nanoAiFeatureCatalogAdCells(item)
  return {
    sku_id: item.id,
    title: clip(item.title, 150),
    description: clip(item.description, 5000),
    availability: item.availability,
    condition: item.condition,
    price: formatPlainPriceVnd(item.priceVnd),
    link: landingLink(origin, item),
    image_link: imageLink(origin, item),
    brand: item.brand,
    google_product_category: NANOAI_GOOGLE_PRODUCT_CATEGORY,
    additional_image_link: ad.additional_image_link,
    product_type: clip(item.productType, 750),
    color: ad.color,
    size: ad.size,
    sale_price: ad.sale_price,
    sale_price_effective_date: ad.sale_price_effective_date,
    item_group_id: ad.item_group_id,
    gender: ad.gender,
    age_group: ad.age_group,
    shipping_weight: ad.shipping_weight,
    video_link: ad.video_link,
    video_url: ad.video_url,
  }
}

export function buildNanoAiGoogleMerchantFeedTsv(origin: string): Buffer {
  const lines = [NANOAI_GOOGLE_MERCHANT_HEADERS.join('\t')]
  for (const item of listNanoAiFacebookCatalogItems()) {
    const cells = googleCells(origin, item)
    lines.push(NANOAI_GOOGLE_MERCHANT_HEADERS.map((name) => tsvCell(cells[name] ?? '')).join('\t'))
  }
  return Buffer.from(`${lines.join('\n')}\n`, 'utf8')
}

export function buildNanoAiTikTokCatalogFeedCsv(origin: string): Buffer {
  const rows = listNanoAiFacebookCatalogItems().map((item) => {
    const cells = tiktokCells(origin, item)
    return NANOAI_TIKTOK_CATALOG_HEADERS.map((name) => cells[name] ?? '')
  })
  const csv = [NANOAI_TIKTOK_CATALOG_HEADERS, ...rows]
    .map((line) => line.map((cell) => csvCell(String(cell))).join(','))
    .join('\r\n')
  return Buffer.from(`\ufeff${csv}\r\n`, 'utf8')
}
