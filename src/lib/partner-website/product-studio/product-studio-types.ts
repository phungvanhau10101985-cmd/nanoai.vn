import type { Json } from '@/types/database.types'

/**
 * PS.1 — Product Studio: đăng sản phẩm thủ công/AI (tham chiếu 188 manual_product_create,
 * tổng quát hoá multi-tenant). Xem docs/PARTNER_WEBSITE_AND_LANDING_UPGRADE_188.md nhóm PS.*.
 */

export const PRODUCT_STUDIO_MODES = ['manual', 'ai'] as const
export type ProductStudioMode = (typeof PRODUCT_STUDIO_MODES)[number]

export const PRODUCT_STUDIO_JOB_STATUSES = [
  'draft',
  'generating',
  'ready_for_review',
  'publishing',
  'done',
  'failed',
] as const
export type ProductStudioJobStatus = (typeof PRODUCT_STUDIO_JOB_STATUSES)[number]

export const PRODUCT_STUDIO_PRODUCT_TYPES = [
  'apparel',
  'shoes',
  'accessory',
  'household',
  'food',
  'other',
] as const
export type ProductStudioProductType = (typeof PRODUCT_STUDIO_PRODUCT_TYPES)[number]

export const PRODUCT_STUDIO_SHOT_STYLES = ['studio', 'lifestyle', 'outdoor'] as const
export type ProductStudioShotStyle = (typeof PRODUCT_STUDIO_SHOT_STYLES)[number]

export const PRODUCT_STUDIO_MODEL_PRESENCE = ['none', 'model'] as const
export type ProductStudioModelPresence = (typeof PRODUCT_STUDIO_MODEL_PRESENCE)[number]

export type ProductStudioColorItem = { name: string; img: string }

/** Slot ảnh AI: màu -> gallery -> chi tiết/chất liệu (thứ tự cố định, giống Studio 188). */
export const PRODUCT_STUDIO_SLOT_KINDS = ['color', 'gallery', 'detail', 'material'] as const
export type ProductStudioSlotKind = (typeof PRODUCT_STUDIO_SLOT_KINDS)[number]

export type ProductStudioJobPayload = {
  mode: ProductStudioMode
  price: number
  material: string
  productName: string
  /** Mô tả hiển thị công khai — mode thủ công merchant tự nhập; mode AI để trống thì PS.7 (DeepSeek) viết. */
  description?: string
  productType: ProductStudioProductType
  gender: string
  style: string
  sizes: string[]
  noSize: boolean
  colors: ProductStudioColorItem[]
  available: number
  notes: string
  brandName?: string | null
  categoryId?: string | null
  // Manual mode — ảnh thật đã upload
  mainImage?: string | null
  images?: string[]
  gallery?: string[]
  // AI mode — ảnh tham chiếu (không public) + cấu hình sinh ảnh
  refImageUrls?: string[]
  galleryCount?: number
  detailCount?: number
  imageModel?: string
  aspectRatio?: string
  modelPresence?: ProductStudioModelPresence
  modelGender?: string
  modelAgeGroup?: string
  modelEthnicity?: string
  shotStyle?: ProductStudioShotStyle
}

export type ProductStudioRefPoolItem = {
  id: string
  url: string
  label: string
  kind: ProductStudioSlotKind
}

export type ProductStudioCurrentSlot = {
  kind: ProductStudioSlotKind
  /** Tên màu đang tạo (chỉ có nghĩa khi kind=color). */
  name?: string
  candidateUrl?: string
  promptUsed?: string
  approved?: boolean
  error?: string
}

export type ProductStudioState = {
  productKey?: string
  colors: ProductStudioColorItem[]
  gallery: string[]
  detail: string[]
  materialImage?: string | null
  materialBody?: string | null
  materialCallouts?: string[]
  mainImage?: string | null
  refPool: ProductStudioRefPoolItem[]
  currentSlot?: ProductStudioCurrentSlot | null
}

export type ProductStudioJobRow = {
  id: string
  partnerId: string
  createdBy: string | null
  mode: ProductStudioMode
  status: ProductStudioJobStatus
  step: string | null
  message: string | null
  progress: number
  payload: ProductStudioJobPayload
  studio: ProductStudioState
  visionProductName: string | null
  visionAnalysis: string | null
  visionColors: string[]
  result: ProductStudioPublishResult | null
  errorMessage: string | null
  warnings: string[]
  createdAt: string
  updatedAt: string
}

export type ProductStudioPublishResult = {
  inventoryId: string
  name: string
  categoryId: string | null
  categoryPath: string | null
  landingId: string | null
  landingSlug: string | null
  warnings: string[]
}

export function defaultProductStudioState(): ProductStudioState {
  return { colors: [], gallery: [], detail: [], refPool: [], currentSlot: null }
}

export function jsonToProductStudioPayload(raw: Json): ProductStudioJobPayload {
  const o = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>
  const mode: ProductStudioMode = o.mode === 'ai' ? 'ai' : 'manual'
  const productType = PRODUCT_STUDIO_PRODUCT_TYPES.includes(o.productType as ProductStudioProductType)
    ? (o.productType as ProductStudioProductType)
    : 'apparel'
  return {
    mode,
    price: Number(o.price ?? 0) || 0,
    material: String(o.material ?? '').trim(),
    productName: String(o.productName ?? '').trim(),
    description: o.description ? String(o.description).trim() : undefined,
    productType,
    gender: String(o.gender ?? '').trim(),
    style: String(o.style ?? '').trim(),
    sizes: Array.isArray(o.sizes) ? o.sizes.map((x) => String(x ?? '').trim()).filter(Boolean) : [],
    noSize: Boolean(o.noSize),
    colors: Array.isArray(o.colors)
      ? o.colors
          .map((c) => {
            const co = (c ?? {}) as Record<string, unknown>
            return { name: String(co.name ?? '').trim(), img: String(co.img ?? '').trim() }
          })
          .filter((c) => c.name)
      : [],
    available: Number(o.available ?? 500) || 0,
    notes: String(o.notes ?? '').trim(),
    brandName: o.brandName ? String(o.brandName).trim() : null,
    categoryId: o.categoryId ? String(o.categoryId).trim() : null,
    mainImage: o.mainImage ? String(o.mainImage).trim() : null,
    images: Array.isArray(o.images) ? o.images.map((x) => String(x ?? '').trim()).filter(Boolean) : [],
    gallery: Array.isArray(o.gallery) ? o.gallery.map((x) => String(x ?? '').trim()).filter(Boolean) : [],
    refImageUrls: Array.isArray(o.refImageUrls)
      ? o.refImageUrls.map((x) => String(x ?? '').trim()).filter(Boolean)
      : [],
    galleryCount: Number(o.galleryCount ?? 5) || 5,
    detailCount: Number(o.detailCount ?? 3) || 3,
    imageModel: String(o.imageModel ?? 'pro').trim() || 'pro',
    aspectRatio: String(o.aspectRatio ?? '1:1').trim() || '1:1',
    modelPresence: o.modelPresence === 'model' ? 'model' : 'none',
    modelGender: String(o.modelGender ?? '').trim(),
    modelAgeGroup: String(o.modelAgeGroup ?? '').trim(),
    modelEthnicity: String(o.modelEthnicity ?? '').trim(),
    shotStyle: PRODUCT_STUDIO_SHOT_STYLES.includes(o.shotStyle as ProductStudioShotStyle)
      ? (o.shotStyle as ProductStudioShotStyle)
      : 'studio',
  }
}

export function jsonToProductStudioState(raw: Json): ProductStudioState {
  const o = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>
  return {
    productKey: o.productKey ? String(o.productKey).trim() : undefined,
    colors: Array.isArray(o.colors)
      ? o.colors
          .map((c) => {
            const co = (c ?? {}) as Record<string, unknown>
            return { name: String(co.name ?? '').trim(), img: String(co.img ?? '').trim() }
          })
          .filter((c) => c.name && c.img)
      : [],
    gallery: Array.isArray(o.gallery) ? o.gallery.map((x) => String(x ?? '').trim()).filter(Boolean) : [],
    detail: Array.isArray(o.detail) ? o.detail.map((x) => String(x ?? '').trim()).filter(Boolean) : [],
    materialImage: o.materialImage ? String(o.materialImage).trim() : null,
    materialBody: o.materialBody ? String(o.materialBody).trim() : null,
    materialCallouts: Array.isArray(o.materialCallouts)
      ? o.materialCallouts.map((x) => String(x ?? '').trim()).filter(Boolean)
      : [],
    mainImage: o.mainImage ? String(o.mainImage).trim() : null,
    refPool: Array.isArray(o.refPool)
      ? (o.refPool as Record<string, unknown>[]).map((r) => ({
          id: String(r.id ?? ''),
          url: String(r.url ?? ''),
          label: String(r.label ?? ''),
          kind: PRODUCT_STUDIO_SLOT_KINDS.includes(r.kind as ProductStudioSlotKind)
            ? (r.kind as ProductStudioSlotKind)
            : 'gallery',
        }))
      : [],
    currentSlot: o.currentSlot && typeof o.currentSlot === 'object' ? (o.currentSlot as ProductStudioCurrentSlot) : null,
  }
}
