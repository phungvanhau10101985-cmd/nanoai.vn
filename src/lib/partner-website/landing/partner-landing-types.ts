import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerWebsiteProject } from '@/lib/partner-website/partner-website-types'

export const PARTNER_LANDING_MAX_PRODUCTS = 8

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
