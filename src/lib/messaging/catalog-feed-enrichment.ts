/**
 * Bổ sung trường catalog (Meta / Google Merchant / TikTok) theo chuẩn feed 188:
 * gender, age_group, color, size, material, product_type, google_product_category,
 * sale_price_effective_date, custom_label_0–4, identifier, video.
 * Không hardcode taxonomy một shop — default Google/Meta category theo industry_key.
 */

import {
  catalogFeedCurrency,
  catalogFeedItemId,
  catalogFeedPriceAmount,
  catalogFeedSalePriceAmount,
  catalogFeedSku,
  catalogFeedTrimMax,
  formatCatalogFeedPrice,
  isAbsoluteHttpUrl,
  type CatalogFeedInventoryRow,
  type CatalogFeedShopLanding,
} from '@/lib/messaging/catalog-feed-shared'
import {
  parseInventoryColorsForFacet,
  parseInventorySizesForFacet,
} from '@/lib/partner-website/shop/partner-shop-industry-facets'

export type CatalogFeedIndustryKey = 'fashion' | 'hotel' | 'food' | 'other' | null

export type CatalogFeedBuildContext = {
  platformOrigin: string
  partnerSlug: string
  brand: string
  shop: CatalogFeedShopLanding | null
  industryKey: CatalogFeedIndustryKey
  /** Breadcrumb danh mục chính: "Túi > Túi đeo chéo" */
  productTypeByInventoryId: Record<string, string>
}

export function emptyCatalogFeedBuildContext(
  partial: Pick<CatalogFeedBuildContext, 'platformOrigin' | 'partnerSlug' | 'brand' | 'shop'> &
    Partial<Pick<CatalogFeedBuildContext, 'industryKey' | 'productTypeByInventoryId'>>
): CatalogFeedBuildContext {
  return {
    ...partial,
    industryKey: partial.industryKey ?? null,
    productTypeByInventoryId: partial.productTypeByInventoryId ?? {},
  }
}

export function catalogFeedProductType(
  row: Pick<CatalogFeedInventoryRow, 'id'>,
  ctx: Pick<CatalogFeedBuildContext, 'productTypeByInventoryId'>
): string {
  return catalogFeedTrimMax((ctx.productTypeByInventoryId[row.id] ?? '').trim(), 750)
}

export function catalogFeedBrand(ctx: Pick<CatalogFeedBuildContext, 'brand'>, max = 70): string {
  return catalogFeedTrimMax((ctx.brand || 'Shop').trim(), max)
}

export function catalogFeedColor(
  row: Pick<CatalogFeedInventoryRow, 'colors_json' | 'stock_note'>
): string {
  const names = parseInventoryColorsForFacet(row.stock_note, row.colors_json)
  return catalogFeedTrimMax(names.slice(0, 20).join(', '), 200)
}

export function catalogFeedSize(
  row: Pick<CatalogFeedInventoryRow, 'sizes_json' | 'description'>
): string {
  const sizes = parseInventorySizesForFacet(row.description, row.sizes_json)
  return catalogFeedTrimMax(sizes.slice(0, 30).join(', '), 300)
}

export function catalogFeedMaterial(row: Pick<CatalogFeedInventoryRow, 'material_note'>): string {
  const raw = (row.material_note ?? '').trim()
  if (!raw || raw.startsWith('[') || raw.startsWith('{')) return ''
  return catalogFeedTrimMax(raw.replace(/\s+/g, ' '), 200)
}

export function catalogFeedVideoUrl(row: Pick<CatalogFeedInventoryRow, 'product_video_url'>): string {
  const v = (row.product_video_url ?? '').trim()
  return isAbsoluteHttpUrl(v) ? v : ''
}

function genderFromRaw(raw: string): string {
  const g = raw.trim().toLowerCase()
  if (!g) return ''
  if (['male', 'm', 'nam'].includes(g)) return 'male'
  if (['female', 'f', 'nữ', 'nu'].includes(g)) return 'female'
  if (['unisex', 'unisexual'].includes(g)) return 'unisex'
  return ''
}

function scrubVietnamPlaceName(text: string): string {
  return text.replace(/vi[eêệ]t\s+nam\b/gi, ' ')
}

function textHasGenderNam(text: string): boolean {
  const t = scrubVietnamPlaceName(text || '').trim()
  if (/ nam$/i.test(t) || t.endsWith(' Nam')) return true
  return /(?:^|[\s\-_/])nam(?:[\s\-_/]|$)/i.test(t)
}

function textHasGenderNu(text: string): boolean {
  const t = (text || '').trim()
  if (/ nữ$/i.test(t) || t.endsWith(' Nữ')) return true
  return /nữ/i.test(t) || /(?:^|[\s\-_/])nu(?:[\s\-_/]|$)/i.test(t)
}

export function catalogFeedGender(
  row: Pick<CatalogFeedInventoryRow, 'name'>,
  productType: string
): string {
  const blob = [row.name, productType].filter(Boolean).join(' ')
  if (!blob.trim()) return ''
  const hasNam = textHasGenderNam(blob)
  const hasNu = textHasGenderNu(blob)
  if (hasNam && hasNu) return 'unisex'
  if (hasNam) return 'male'
  if (hasNu) return 'female'
  return genderFromRaw(blob)
}

const AGE_GROUP_VALID = new Set(['newborn', 'infant', 'toddler', 'kids', 'adult'])

export function catalogFeedAgeGroup(
  row: Pick<CatalogFeedInventoryRow, 'name'>,
  productType: string
): string {
  const blob = `${row.name ?? ''} ${productType}`.toLowerCase()
  if (/(sơ sinh|so sinh|newborn)/i.test(blob)) return 'newborn'
  if (/(trẻ em|tre em|bé trai|be trai|bé gái|be gai|\bkids\b|\bkid\b)/i.test(blob)) return 'kids'
  if (/(người lớn|nguoi lon|\badult\b)/i.test(blob)) return 'adult'
  const direct = blob.trim()
  return AGE_GROUP_VALID.has(direct) ? direct : ''
}

export function defaultGoogleProductCategory(industryKey: CatalogFeedIndustryKey): string {
  if (industryKey === 'fashion') return 'Apparel & Accessories'
  if (industryKey === 'food') return 'Food, Beverages & Tobacco'
  return ''
}

export function catalogFeedGoogleProductCategory(
  row: Pick<CatalogFeedInventoryRow, 'id'>,
  ctx: CatalogFeedBuildContext
): string {
  const fallback = defaultGoogleProductCategory(ctx.industryKey)
  return catalogFeedProductType(row, ctx) ? fallback || catalogFeedProductType(row, ctx) : fallback
}

export function catalogFeedFbProductCategory(ctx: CatalogFeedBuildContext, googleCat: string): string {
  if (ctx.industryKey === 'fashion') return 'Apparel & Accessories'
  return googleCat
}

function customLabel0ByPrice(price: number | null): string {
  if (price == null || !Number.isFinite(price) || price <= 0) return ''
  const tiers: Array<[number, string]> = [
    [400_000, 'under_400k'],
    [700_000, 'under_700k'],
    [1_000_000, 'under_1m'],
    [1_300_000, 'under_1_3m'],
    [1_600_000, 'under_1_6m'],
    [1_900_000, 'under_1_9m'],
    [2_200_000, 'under_2_2m'],
    [2_500_000, 'under_2_5m'],
    [2_800_000, 'under_2_8m'],
    [300_000_000, 'over_2_8m'],
  ]
  for (const [max, label] of tiers) {
    if (price <= max) return label
  }
  return ''
}

export function catalogFeedCustomLabels(
  row: CatalogFeedInventoryRow,
  productType: string
): [string, string, string, string, string] {
  const price = catalogFeedPriceAmount(row)
  const parts = productType
    .split('>')
    .map((s) => s.trim())
    .filter(Boolean)
  const root = parts[0] ?? ''
  const leaf = parts.length > 1 ? parts[parts.length - 1] : ''
  const gender = catalogFeedGender(row, productType)
  return [
    customLabel0ByPrice(price),
    catalogFeedTrimMax(root, 100),
    gender,
    catalogFeedIsMovingLabel(row),
    catalogFeedTrimMax(leaf, 100),
  ]
}

function catalogFeedIsMovingLabel(row: Pick<CatalogFeedInventoryRow, 'stock_qty'>): string {
  const qty = row.stock_qty
  if (qty != null && qty <= 0) return 'out_of_stock'
  if (qty != null && qty <= 3) return 'low_stock'
  return 'in_stock'
}

function vnDayStamp(iso: string | null | undefined, endOfDay: boolean): string {
  const raw = (iso ?? '').trim()
  if (!raw) return ''
  const dayMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/)
  if (dayMatch) return `${dayMatch[1]}T${endOfDay ? '23:59' : '00:00'}+0700`
  const t = Date.parse(raw)
  if (!Number.isFinite(t)) return ''
  const vn = new Date(t + 7 * 3600 * 1000)
  const y = vn.getUTCFullYear()
  const m = String(vn.getUTCMonth() + 1).padStart(2, '0')
  const d = String(vn.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}T${endOfDay ? '23:59' : '00:00'}+0700`
}

export function catalogFeedSaleEffectiveDate(
  row: Pick<CatalogFeedInventoryRow, 'sale_price_amount' | 'sale_starts_at' | 'sale_ends_at' | 'price_amount' | 'price_hint'>
): string {
  const regular = catalogFeedPriceAmount(row)
  if (regular == null) return ''
  if (catalogFeedSalePriceAmount(row, regular) == null) return ''
  const start = vnDayStamp(row.sale_starts_at, false)
  const end = vnDayStamp(row.sale_ends_at, true)
  if (start && end) return `${start}/${end}`
  if (start) return `${start}/${vnDayStamp(row.sale_starts_at, true)}`
  if (end) {
    const endStart = vnDayStamp(row.sale_ends_at, false)
    return endStart && end ? `${endStart}/${end}` : ''
  }
  return ''
}

export function catalogFeedSalePriceCell(
  row: CatalogFeedInventoryRow
): { sale: string; effective: string } {
  const regular = catalogFeedPriceAmount(row)
  if (regular == null) return { sale: '', effective: '' }
  const saleNum = catalogFeedSalePriceAmount(row, regular)
  if (saleNum == null) return { sale: '', effective: '' }
  return {
    sale: formatCatalogFeedPrice(saleNum, catalogFeedCurrency(row)),
    effective: catalogFeedSaleEffectiveDate(row),
  }
}

export function catalogFeedMpn(row: Pick<CatalogFeedInventoryRow, 'sku'>): string {
  return catalogFeedSku(row)
}

export function catalogFeedIdentifierExists(row: Pick<CatalogFeedInventoryRow, 'sku'>): string {
  return catalogFeedMpn(row) ? 'yes' : 'no'
}

export function catalogFeedItemGroupId(row: CatalogFeedInventoryRow): string {
  const sku = catalogFeedSku(row)
  const hasVariants =
    parseInventoryColorsForFacet(row.stock_note, row.colors_json).length > 1 ||
    parseInventorySizesForFacet(row.description, row.sizes_json).length > 1
  if (!hasVariants) return ''
  return sku || catalogFeedItemId(row)
}

function slugLabel(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 100)
}

export function catalogFeedInternalLabel(
  row: Pick<CatalogFeedInventoryRow, 'id'>,
  productType: string
): string {
  const parts = productType
    .split('>')
    .map((s) => slugLabel(s.trim()))
    .filter(Boolean)
    .slice(0, 8)
  if (!parts.length) return ''
  return `[${parts.map((p) => `'${p}'`).join(',')}]`
}
