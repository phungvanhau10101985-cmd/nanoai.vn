import { fetchPartnerAllowAutoCreateCategoriesFromPg } from '@/lib/db/messaging-partner-category-auto-create-pg'
import { applyListingImportTaxonomy } from '@/lib/messaging/listing-import/listing-import-taxonomy'
import { compactListingImportProductInfoForWeb } from '@/lib/messaging/listing-import/listing-import-product-info-compact'
import { inferQuestionGroupIdFromProductName } from '@/lib/messaging/listing-import/listing-import-rating-groups'
import {
  buildCatalog188Snapshot,
  catalogFieldsFromSnapshot,
  type Catalog188Color,
  type InventoryCatalog188Fields,
} from '@/lib/messaging/partner-inventory-catalog-188'
import { catalogWithInternalSku } from '@/lib/messaging/partner-inventory-internal-sku'
import { CATEGORY_AUTO_CREATE_DISABLED } from '@/lib/partner-website/category/partner-category-place-product'
import { CATEGORY_AUTO_CREATE_DISABLED_MESSAGE } from '@/lib/partner-website/category/partner-category-auto-create-copy'
import { slugifyPartnerProductName } from '@/lib/partner-website/shop/partner-site-product-slug'
import type { ProductStudioJobPayload } from '@/lib/partner-website/product-studio/product-studio-types'

export const LADIPAGE_REQUIRED_MESSAGE =
  'Không tạo được Ladipage 1 SP — trang sản phẩm sẽ không có hero/highlights/FAQ.'
export const STUDIO_SEO_NAME_MISSING = 'Chưa đặt được tên SEO từ ảnh màu.'
export const STUDIO_TAXONOMY_INCOMPLETE =
  'Không gán được danh mục taxonomy chuẩn (category / subcategory / sub_subcategory).'

const TYPE_VI: Record<string, string> = {
  apparel: 'quần áo',
  shoes: 'giày dép',
  accessory: 'phụ kiện',
  household: 'gia dụng',
  food: 'thực phẩm',
  other: 'hàng hóa',
}

/** Hậu tố giới tính chỉ để DeepSeek phân loại. Không ghi lên PDP. */
export function studioClassificationChineseName(name: string, gender: string): string {
  const base = name.trim()
  if (!base) return ''
  if (gender === 'male') return `${base} 男士 男款`
  if (gender === 'female') return `${base} 女士 女款`
  return ''
}

export function studioQuestionGroupId(name: string, gender: string): number {
  if (gender === 'male') return 100
  if (gender === 'female') return 88
  return inferQuestionGroupIdFromProductName(name)
}

export function composeLadipageDescription(
  sections: Array<{ sectionType: string; data: Record<string, unknown> }>
): string {
  const parts: string[] = []
  for (const section of sections) {
    const data = section.data || {}
    if (section.sectionType === 'hero') {
      const headline = String(data.headline || '').trim()
      const subheadline = String(data.subheadline || '').trim()
      if (headline) parts.push(headline)
      if (subheadline) parts.push(subheadline)
    } else if (section.sectionType === 'highlights') {
      const items = Array.isArray(data.items) ? data.items : []
      for (const item of items) {
        if (!item || typeof item !== 'object') continue
        const row = item as Record<string, unknown>
        const title = String(row.title || '').trim()
        const desc = String(row.desc || '').trim()
        if (title && desc) parts.push(`${title}: ${desc}`)
        else if (title || desc) parts.push(title || desc)
      }
    } else if (section.sectionType === 'material' || section.sectionType === 'trust_cta') {
      const body = String(data.body || '').trim()
      if (body) parts.push(body)
    }
  }
  return parts.join('\n\n').trim()
}

/** Chỉ ghi đè mô tả ngắn. Mô tả merchant dài giữ nguyên. */
export function shouldAdoptLadipageDescription(current: string, composed: string): boolean {
  const text = composed.trim()
  if (text.length < 80) return false
  if (current.trim().length >= 350) return false
  return text !== current.trim()
}

function str(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim() : ''
}

function stringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => String(item ?? '').trim()).filter(Boolean)
}

function classificationBlob(payload: ProductStudioJobPayload, merchantDescription: string): string {
  const gender =
    payload.gender === 'male'
      ? 'Giới tính: nam'
      : payload.gender === 'female'
        ? 'Giới tính: nữ'
        : payload.gender === 'unisex'
          ? 'Giới tính: nam nữ'
          : ''
  return [
    `Loại: ${TYPE_VI[payload.productType] || payload.productType}`,
    gender,
    payload.material.trim() ? `Chất liệu: ${payload.material.trim()}` : '',
    payload.notes.trim(),
    merchantDescription,
  ]
    .filter(Boolean)
    .join('\n')
}

export type StudioClassifyResult = {
  ok: boolean
  error?: string
  warnings: string[]
  name: string
  description: string
  categoryId: string | null
  productData: Record<string, unknown>
}

export async function classifyStudioProductForPublish(input: {
  partnerId: string
  payload: ProductStudioJobPayload
  lockedName: string
  colors: { name: string; img: string }[]
  sizes: string[]
}): Promise<StudioClassifyResult> {
  const warnings: string[] = []
  const payload = input.payload
  const merchant = (payload.description ?? '').trim()
  const sent = classificationBlob(payload, merchant)
  const hint = studioClassificationChineseName(input.lockedName, payload.gender)
  const productData: Record<string, unknown> = {
    name: input.lockedName,
    description: sent,
    material: payload.material.trim(),
    sizes: input.sizes,
    colors: input.colors.map((color) => ({ name: color.name, img: color.img })),
    available: true,
  }
  if (hint) productData.chinese_name = hint

  const allowCreate = await fetchPartnerAllowAutoCreateCategoriesFromPg(input.partnerId)
  let tax: { ok: boolean; error?: string } = { ok: true }
  try {
    tax = await applyListingImportTaxonomy(input.partnerId, productData, warnings, { allowCreate })
  } catch (e) {
    tax = { ok: false, error: e instanceof Error ? e.message : String(e) }
  }

  if (hint && str(productData.chinese_name) === hint) delete productData.chinese_name
  productData.name = input.lockedName

  const after = str(productData.description)
  const description = merchant || (after && after !== sent ? after : '')
  productData.description = description

  const hasTriple = Boolean(str(productData.category) && str(productData.subcategory) && str(productData.sub_subcategory))
  const categoryId = str(productData._category_id) || null
  const strict = payload.mode === 'ai'

  if (strict && (!tax.ok || !hasTriple || !categoryId)) {
    const error =
      tax.error === CATEGORY_AUTO_CREATE_DISABLED
        ? CATEGORY_AUTO_CREATE_DISABLED_MESSAGE
        : tax.error && tax.error !== CATEGORY_AUTO_CREATE_DISABLED
          ? tax.error
          : STUDIO_TAXONOMY_INCOMPLETE
    return { ok: false, error, warnings, name: input.lockedName, description, categoryId: null, productData }
  }

  if (!hasTriple || !categoryId) {
    warnings.push(
      tax.error === CATEGORY_AUTO_CREATE_DISABLED ? CATEGORY_AUTO_CREATE_DISABLED_MESSAGE : STUDIO_TAXONOMY_INCOMPLETE
    )
    return { ok: true, warnings, name: input.lockedName, description, categoryId: null, productData }
  }

  return { ok: true, warnings, name: input.lockedName, description, categoryId, productData }
}

export function buildStudioInventoryCatalog(input: {
  productData: Record<string, unknown>
  remarketingId: string
  sku: string
  name: string
  description: string
  price: number
  shopName: string
  mainImage: string
  gallery: string[]
  detail: string[]
  colors: { name: string; img: string }[]
  sizes: string[]
  stockQty: number
  materialFallback: string
  gender: string
}): InventoryCatalog188Fields {
  const productData = input.productData
  compactListingImportProductInfoForWeb(productData)
  const info = productData.product_info
  if (info && typeof info === 'object') {
    const bag = info as Record<string, unknown>
    const inner = bag.product_info
    if (inner && typeof inner === 'object') {
      ;(inner as Record<string, unknown>).sku = input.sku
    } else {
      bag.product_info = { sku: input.sku }
    }
  }
  const rating = Number(productData._l3_rating_group_id)
  const colors: Catalog188Color[] = input.colors.map((color) => ({
    name: color.name,
    img: color.img || input.mainImage,
  }))
  const slug = str(productData.slug_seo) || slugifyPartnerProductName(input.name)
  const snap = buildCatalog188Snapshot({
    productId: input.remarketingId,
    sku: input.sku,
    origin: str(productData.origin),
    brand: str(productData.brand_name),
    name: input.name,
    description: input.description,
    price: input.price,
    shopName: input.shopName,
    shopId: '',
    priceLow: '',
    priceHigh: '',
    ratingGroupId: Number.isFinite(rating) && rating > 0 ? Math.round(rating) : 0,
    questionGroupId: studioQuestionGroupId(input.name, input.gender),
    sizes: input.sizes,
    colors,
    gallery: input.gallery,
    detail: input.detail,
    productUrl: '',
    videoUrl: '',
    mainImage: input.mainImage,
    likes: 0,
    purchases: 0,
    reviews: 0,
    questions: 0,
    ratingScore: 0,
    stockQty: input.stockQty,
    depositRequired: false,
    categoryL1: str(productData.category),
    categoryL2: str(productData.subcategory),
    categoryL3: str(productData.sub_subcategory),
    material: str(productData.material) || input.materialFallback,
    style: str(productData.style),
    color: str(productData.color) || colors.map((color) => color.name).filter(Boolean).join(', '),
    occasion: str(productData.occasion),
    features: stringList(productData.features),
    weight: str(productData.weight),
    productInfo: info && typeof info === 'object' ? (info as Record<string, unknown>) : null,
    chineseName: str(productData.chinese_name),
    shopNameChinese: '',
    slug,
  })
  return catalogWithInternalSku(catalogFieldsFromSnapshot(snap), input.sku) as InventoryCatalog188Fields
}
