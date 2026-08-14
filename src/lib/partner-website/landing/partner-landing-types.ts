import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerWebsiteProject } from '@/lib/partner-website/partner-website-types'

/** Giống 188: chọn nhiều SP trên 1 landing (không còn giới hạn 8). */
export const PARTNER_LANDING_MAX_PRODUCTS = 60
export const PARTNER_LANDING_CATEGORY_LIMIT_MAX = 60

export type LandingAiKind = 'single' | 'category' | 'multi'

export function landingAiKindOf(lp: {
  sourceType: PartnerLandingSourceType
  inventoryIds: string[]
}): LandingAiKind {
  if (lp.sourceType === 'category') return 'category'
  return lp.inventoryIds.length <= 1 ? 'single' : 'multi'
}

export type PartnerLandingSourceType = 'products' | 'category'

export type PartnerLandingPageRow = {
  id: string
  partnerId: string
  websiteId: string
  landingSlug: string
  title: string
  briefText: string
  locale: WebLocale
  inventoryIds: string[]
  project: PartnerWebsiteProject
  htmlSource: string | null
  referenceImageUrls: string[]
  mockupUrl: string | null
  isPublished: boolean
  publishedAt: string | null
  createdAt: string
  updatedAt: string
  /** L3.2 — products (1-8 SP, hành vi cũ) | category (top N sản phẩm live theo categoryId). */
  sourceType: PartnerLandingSourceType
  categoryId: string | null
  productsLimit: number
  materialFilter: string | null
  metaTitle: string | null
  metaDescription: string | null
}

export type PartnerLandingPagePublicRow = PartnerLandingPageRow & {
  siteSlug: string
  partnerSlug: string
  chatPath: string
  logoUrl: string | null
}

export type PartnerLandingProductSnapshot = {
  id: string
  name: string
  price: string
  description: string
  imageUrl: string
  detailPath: string
}
