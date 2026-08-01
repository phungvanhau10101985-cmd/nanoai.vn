import { fetchPublishedPartnerWebsiteBySlugPg } from '@/lib/db/messaging-partner-websites-pg'
import { resolveActiveMessagingPartnerBySlug } from '@/lib/messaging/resolve-active-messaging-partner'
import type { PartnerWebsitePublicRow } from '@/lib/partner-website/partner-website-types'

export type PartnerSiteShopContext = {
  site: PartnerWebsitePublicRow
  partnerId: string
  partnerSlug: string
}

export async function loadPartnerSiteShopContext(siteSlug: string): Promise<PartnerSiteShopContext | null> {
  const slug = siteSlug.trim().toLowerCase()
  if (!slug) return null
  const site = await fetchPublishedPartnerWebsiteBySlugPg(slug)
  if (!site) return null
  const partner = await resolveActiveMessagingPartnerBySlug(site.partnerSlug)
  if (!partner || partner.industry_key === 'hotel') return null
  return {
    site,
    partnerId: partner.id,
    partnerSlug: site.partnerSlug,
  }
}
