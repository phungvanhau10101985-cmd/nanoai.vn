import type { NextRequest } from 'next/server'
import { getPublicAppUrlForServer } from '@/lib/auth/public-app-url'
import { fetchPartnerWebsiteConfiguredSiteOriginPg } from '@/lib/db/messaging-partner-custom-domains-pg'
import { partnerWebsitePublicPath } from '@/lib/partner-website/partner-website-slug'

/** URL công khai website shop — ưu tiên tên miền đã lưu trong quản trị (kể cả chờ DNS/SSL). */
export async function resolvePartnerWebsitePublicUrl(input: {
  partnerId: string
  siteSlug: string
  isPublished: boolean
  req?: Request | NextRequest
}): Promise<string | null> {
  const slug = input.siteSlug.trim()
  if (!input.isPublished || !slug) return null

  const customOrigin = await fetchPartnerWebsiteConfiguredSiteOriginPg(input.partnerId)
  if (customOrigin) {
    return `${customOrigin.replace(/\/$/, '')}/`
  }

  const base = getPublicAppUrlForServer(input.req).replace(/\/$/, '')
  return `${base}${partnerWebsitePublicPath(slug)}`
}
