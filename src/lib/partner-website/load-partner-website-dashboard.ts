import {
  fetchMessagingPartnersForDashboardFromPg,
  type MessagingPartnerDashboardRow,
} from '@/lib/db/messaging-partners-pg'
import { listPartnerWebsitesForPartnersPg } from '@/lib/db/messaging-partner-websites-pg'
import { isPgConfigured } from '@/lib/db/pool'
import type { WebLocale } from '@/lib/i18n/config'
import { syncPartnerWebsiteFullLandingPg } from '@/lib/partner-website/sync-partner-website-full-landing'
import { isFullLandingV1Template } from '@/lib/partner-website/template/upgrade-landing-v1-template'
import type { PartnerWebsiteRow } from '@/lib/partner-website/partner-website-types'

export function partnerCanManageWebsite(p: MessagingPartnerDashboardRow): boolean {
  if (p.dashboard_access === 'owner') return true
  return Boolean(p.staff_permissions?.website)
}

export type PartnerWebsiteDashboardData = {
  allPartners: MessagingPartnerDashboardRow[]
  partners: MessagingPartnerDashboardRow[]
  initialPartnerId: string
  initialWebsites: Record<string, PartnerWebsiteRow | null>
}

export async function loadPartnerWebsiteDashboardData(input: {
  userId: string
  locale: WebLocale
  requestedPartnerId?: string
  requestedSlug?: string
}): Promise<PartnerWebsiteDashboardData> {
  let allPartners: MessagingPartnerDashboardRow[] = []
  if (isPgConfigured()) {
    const fromPg = await fetchMessagingPartnersForDashboardFromPg(input.userId)
    if (fromPg !== null) {
      allPartners = fromPg.filter((p) => p.industry_key !== 'hotel')
    }
  }

  const partners = allPartners.filter(partnerCanManageWebsite)

  const slug = input.requestedSlug?.trim().toLowerCase() ?? ''
  const bySlug = slug ? partners.find((p) => p.slug.toLowerCase() === slug) : null

  const requestedPartnerId = input.requestedPartnerId?.trim() ?? ''
  const byId =
    requestedPartnerId && partners.some((p) => p.id === requestedPartnerId)
      ? requestedPartnerId
      : ''

  const initialPartnerId = bySlug?.id ?? byId ?? partners[0]?.id ?? ''

  const websiteMap = isPgConfigured()
    ? await listPartnerWebsitesForPartnersPg(partners.map((p) => p.id))
    : new Map()

  const initialWebsites: Record<string, PartnerWebsiteRow | null> = {}
  for (const p of partners) {
    initialWebsites[p.id] = websiteMap.get(p.id) ?? null
  }

  if (initialPartnerId && isPgConfigured()) {
    const row = initialWebsites[initialPartnerId]
    if (row && isFullLandingV1Template(row)) {
      const synced = await syncPartnerWebsiteFullLandingPg({
        partnerId: initialPartnerId,
        locale: input.locale,
        refreshHtml: true,
      })
      if (synced.website) initialWebsites[initialPartnerId] = synced.website
    }
  }

  return { allPartners, partners, initialPartnerId, initialWebsites }
}
