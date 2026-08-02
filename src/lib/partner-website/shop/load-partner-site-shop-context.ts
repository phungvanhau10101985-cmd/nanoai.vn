import { fetchPublishedPartnerWebsiteBySlugPg } from '@/lib/db/messaging-partner-websites-pg'
import { resolveActiveMessagingPartnerBySlug } from '@/lib/messaging/resolve-active-messaging-partner'
import { extractPartnerWebsiteThemeFromProject } from '@/lib/partner-website/extract-theme-from-project'
import type { PartnerWebsitePublicRow } from '@/lib/partner-website/partner-website-types'

export type PartnerSiteShopContext = {
  site: PartnerWebsitePublicRow
  partnerId: string
  partnerSlug: string
}

export async function loadPartnerSiteShopContext(siteSlug: string): Promise<PartnerSiteShopContext | null> {
  const slug = siteSlug.trim().toLowerCase()
  if (!slug) return null
  // Draft sites must resolve too: studio preview + catalog/cart hooks run before Publish.
  const site = await fetchPublishedPartnerWebsiteBySlugPg(slug, { allowDraft: true })
  if (!site) return null
  const partner = await resolveActiveMessagingPartnerBySlug(site.partnerSlug)
  if (!partner || partner.industry_key === 'hotel') return null
  const theme = extractPartnerWebsiteThemeFromProject(site.project, site.theme)
  return {
    site: {
      ...site,
      theme: { ...theme, logoUrl: site.logoUrl ?? theme.logoUrl ?? null },
    },
    partnerId: partner.id,
    partnerSlug: site.partnerSlug,
  }
}
