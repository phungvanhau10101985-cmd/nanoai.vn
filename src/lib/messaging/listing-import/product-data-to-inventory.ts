import {
  buildCatalog188Snapshot,
  catalogFieldsFromSnapshot,
  type Catalog188Color,
} from '@/lib/messaging/partner-inventory-catalog-188'
import type { InventoryExcelInsert } from '@/lib/messaging/partner-inventory-excel'
import { validateInventoryImageUrl } from '@/lib/messaging/partner-inventory-excel'

function str(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return ''
}

function num(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim()) {
    const n = Number.parseFloat(v.replace(/\s/g, '').replace(/,/g, ''))
    if (Number.isFinite(n)) return n
  }
  return fallback
}

function asStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((x) => String(x ?? '').trim()).filter(Boolean)
}

function asColors(raw: unknown): Catalog188Color[] {
  if (!Array.isArray(raw)) return []
  const out: Catalog188Color[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    const name = str(rec.name || rec.label)
    const img = validateInventoryImageUrl(str(rec.img || rec.image || rec.image_url || rec.url))
    if (!name && !img) continue
    out.push({ name: name || 'Màu', img })
  }
  return out
}

function asProductInfo(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  return raw as Record<string, unknown>
}

/** Nháp scrape → dòng Excel 41 cột / upsert kho (remarketing_id = A…/T…). */
export function productDataToInventoryExcelInsert(
  pd: Record<string, unknown>,
  sortOrder = 0
): InventoryExcelInsert | null {
  const productId = str(pd.product_id)
  const name = str(pd.name) || (productId ? `Sản phẩm ${productId}` : '')
  if (!name || !productId) return null
  const gallery = asStringArray(pd.images).map((u) => validateInventoryImageUrl(u)).filter(Boolean)
  const detail = asStringArray(pd.gallery).map((u) => validateInventoryImageUrl(u)).filter(Boolean)
  const colors = asColors(pd.colors)
  const sizes = asStringArray(pd.sizes)
  const mainImage = validateInventoryImageUrl(str(pd.main_image)) || gallery[0] || colors[0]?.img || ''
  const price = num(pd.price, 0)
  const snap = buildCatalog188Snapshot({
    productId,
    sku: str(pd.code),
    origin: str(pd.origin),
    brand: str(pd.brand_name || pd.brand),
    name,
    description: str(pd.description),
    price,
    shopName: str(pd.shop_name),
    shopId: str(pd.shop_id),
    priceLow: str(pd.pro_lower_price),
    priceHigh: str(pd.pro_high_price),
    ratingGroupId: num(pd.group_rating, 888),
    questionGroupId: num(pd.group_question, 0),
    sizes,
    colors,
    gallery,
    detail,
    productUrl: str(pd.link_default),
    videoUrl: str(pd.video_link),
    mainImage,
    likes: num(pd.likes, 0),
    purchases: num(pd.purchases, 0),
    reviews: num(pd.rating_total, 0),
    questions: num(pd.question_total, 0),
    ratingScore: num(pd.rating_point, 0),
    stockQty: num(pd.available, 500),
    depositRequired: num(pd.deposit_require, 1) !== 0,
    categoryL1: str(pd.category),
    categoryL2: str(pd.subcategory),
    categoryL3: str(pd.sub_subcategory),
    material: str(pd.material),
    style: str(pd.style),
    color: str(pd.color),
    occasion: str(pd.occasion),
    features: asStringArray(pd.features),
    weight: str(pd.weight),
    productInfo: asProductInfo(pd.product_info),
    chineseName: str(pd.chinese_name),
    shopNameChinese: str(pd.shop_name_chinese),
    slug: str(pd.slug),
  })
  const catalog = catalogFieldsFromSnapshot(snap)
  const priceHint = price > 0 ? `${new Intl.NumberFormat('vi-VN').format(Math.round(price))}đ` : ''
  return {
    sort_order: sortOrder,
    name: name.slice(0, 500),
    sku: str(pd.code).slice(0, 120) || null,
    description: str(pd.description),
    stock_note: '',
    stock_qty: Math.max(0, Math.round(num(pd.available, 500))),
    price_hint: priceHint,
    image_url: mainImage,
    product_url: str(pd.link_default),
    product_video_url: str(pd.video_link),
    consult_note: '',
    remarketing_id: productId.slice(0, 500),
    is_active: true,
    removeFromInventory: false,
    catalog,
    catalogFormat: '188',
  }
}
