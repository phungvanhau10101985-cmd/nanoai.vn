import type { Json } from '@/types/database.types'

/**
 * L3.1-L3.4 — Ladipage AI: section cố định (hero/highlights/material/products_grid/trust_cta/faq),
 * luôn dựa trên sản phẩm/danh mục THẬT resolve live. Xem docs/PARTNER_WEBSITE_AND_LANDING_UPGRADE_188.md
 * nhóm L3.*. Tổng quát hoá 188 ladipage_ai_service.py cho multi-tenant/đa ngôn ngữ.
 */

export const LANDING_AI_SECTION_TYPES = [
  'hero',
  'highlights',
  'material',
  'products_grid',
  'trust_cta',
  'faq',
] as const
export type LandingAiSectionType = (typeof LANDING_AI_SECTION_TYPES)[number]

export type LandingAiSectionStatus = 'pending' | 'generating' | 'ready' | 'error'

export type LandingHeroData = { headline?: string; subheadline?: string; imageUrl?: string }
export type LandingHighlightItem = { title: string; desc: string }
export type LandingHighlightsData = { items?: LandingHighlightItem[] }
export type LandingMaterialData = {
  material?: string
  body?: string
  callouts?: string[]
  imageUrl?: string
  imageSource?: 'ai' | 'product'
}
export type LandingTrustCtaData = { body?: string; ctaLabel?: string }
export type LandingFaqItem = { q: string; a: string }
export type LandingFaqData = { items?: LandingFaqItem[] }

export type LandingSectionData =
  | LandingHeroData
  | LandingHighlightsData
  | LandingMaterialData
  | LandingTrustCtaData
  | LandingFaqData
  | Record<string, never>

export type LandingAiSectionRow = {
  id: string
  landingId: string
  sectionType: LandingAiSectionType
  orderIndex: number
  status: LandingAiSectionStatus
  data: LandingSectionData
  promptUsed: string | null
  errorMessage: string | null
  createdAt: string
  updatedAt: string
}

export type LandingAiSourceType = 'products' | 'category'

/** Sản phẩm resolve LIVE — không snapshot. Dùng làm ngữ cảnh AI + hiển thị products_grid. */
export type LandingAiProduct = {
  id: string
  name: string
  material: string
  description: string
  imageUrl: string
  galleryImages: string[]
  priceAmount: number | null
  priceHint: string
  detailPath: string
}

export type LandingAiContext = {
  landingId: string
  siteSlug: string
  locale: string
  brandName: string
  title: string
  briefText: string
  sourceType: LandingAiSourceType
  products: LandingAiProduct[]
  categoryName: string | null
  categorySeoTitle: string | null
  categorySeoDescription: string | null
  categoryPath: string | null
  materialFilter: string | null
  dominantMaterial: string | null
  priceMin: number | null
  priceMax: number | null
  /** L3.9 — rating thật (từ W1.5 review), KHÔNG phải AI bịa — trust_cta hiển thị số liệu thực. */
  averageRating: number | null
  totalReviews: number
}

export function defaultLandingSectionPlan(): LandingAiSectionType[] {
  return ['hero', 'highlights', 'material', 'products_grid', 'trust_cta', 'faq']
}

export function jsonToLandingSectionData(raw: Json): LandingSectionData {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as LandingSectionData
  }
  return {}
}
