import { fetchPublishedPartnerWebsiteBySlugPg } from '@/lib/db/messaging-partner-websites-pg'
import { fetchPartnerCapabilitiesForPartnerFromPg } from '@/lib/db/messaging-partners-pg'
import { resolveActiveMessagingPartnerBySlug } from '@/lib/messaging/resolve-active-messaging-partner'
import { extractPartnerWebsiteThemeFromProject } from '@/lib/partner-website/extract-theme-from-project'
import {
  normalizePartnerCapabilities,
  partnerWebsiteEnabled,
  type PartnerCapabilities,
} from '@/lib/partner-website/partner-capabilities'
import type { PartnerWebsitePublicRow } from '@/lib/partner-website/partner-website-types'

export type PartnerSiteShopContext = {
  site: PartnerWebsitePublicRow
  partnerId: string
  partnerSlug: string
  industryKey: 'fashion' | 'hotel' | 'food' | 'other' | null
  capabilities: PartnerCapabilities
}

export async function loadPartnerSiteShopContext(siteSlug: string): Promise<PartnerSiteShopContext | null> {
  const slug = siteSlug.trim().toLowerCase()
  if (!slug) return null
  // Draft sites must resolve too: studio preview + catalog/cart hooks run before Publish.
  const site = await fetchPublishedPartnerWebsiteBySlugPg(slug, { allowDraft: true })
  if (!site) return null
  const partner = await resolveActiveMessagingPartnerBySlug(site.partnerSlug)
  if (!partner) return null
  const capabilities = await fetchPartnerCapabilitiesForPartnerFromPg(partner.id, partner.industry_key)
  if (!partnerWebsiteEnabled(capabilities)) return null
  const theme = extractPartnerWebsiteThemeFromProject(site.project, site.theme)
  return {
    site: {
      ...site,
      theme: { ...theme, logoUrl: site.logoUrl ?? theme.logoUrl ?? null },
    },
    partnerId: partner.id,
    partnerSlug: site.partnerSlug,
    industryKey: partner.industry_key ?? null,
    capabilities,
  }
}

export async function loadPartnerSiteCapabilities(siteSlug: string): Promise<PartnerCapabilities | null> {
  const ctx = await loadPartnerSiteShopContext(siteSlug)
  return ctx?.capabilities ?? null
}

/** Safe parse when only raw JSON + industry is available (no PG round-trip). */
export function partnerSiteCapabilitiesFromJson(
  raw: unknown,
  industryKey: 'fashion' | 'hotel' | 'food' | 'other' | null
): PartnerCapabilities {
  return normalizePartnerCapabilities(raw, industryKey)
}
