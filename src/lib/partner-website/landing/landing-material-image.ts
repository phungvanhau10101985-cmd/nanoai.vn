import type { LandingAiSourceType } from '@/lib/partner-website/landing/landing-ai-types'

export type MaterialImageSource = 'ai' | 'product'

/** 188: ladipage 1 SP mặc định lấy ảnh gallery; danh mục vẫn AI. */
export function resolveLandingMaterialImageSource(input: {
  sourceType: LandingAiSourceType | string
  productCount: number
  stored?: string | null
}): MaterialImageSource {
  const raw = (input.stored || '').trim().toLowerCase()
  if (raw === 'ai' || raw === 'product') return raw
  return input.sourceType === 'products' && input.productCount === 1 ? 'product' : 'ai'
}

/**
 * Một ảnh gallery làm ảnh chất liệu khi không bật AI.
 * Ưu tiên ảnh gallery khác ảnh bìa; chỉ còn một ảnh thì dùng ảnh đó.
 */
export function pickMaterialProductImageUrl(product: {
  imageUrl?: string | null
  galleryImages?: string[] | null
} | null | undefined): string {
  const gallery = (product?.galleryImages ?? []).map((url) => url.trim()).filter(Boolean)
  const cover = (product?.imageUrl || '').trim()
  const extra = gallery.find((url) => url !== cover)
  return extra || gallery[0] || cover
}
