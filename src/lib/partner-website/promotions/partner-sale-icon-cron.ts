import { bumpSiteCacheLater } from '@/lib/cache/partner-shop-cache'
import { fetchMessagingPartnerOwnerUserIdFromPg } from '@/lib/db/messaging-partners-pg'
import { fetchPartnerSaleCalendarConfigFromPg } from '@/lib/db/messaging-partner-sale-calendar-pg'
import { findReadyPartnerSaleIconFromPg } from '@/lib/db/messaging-partner-sale-icon-pg'
import { listWebsitePartnerIdsForMarketingBannersFromPg } from '@/lib/db/messaging-partner-marketing-banner-pg'
import { fetchPartnerWebsitePublishMetaFromPg } from '@/lib/db/messaging-partner-websites-pg'
import { listUpcomingPartnerSaleEvents } from '@/lib/partner-website/promotions/partner-sale-calendar'
import { generatePartnerSaleIcon, loadPartnerSaleIconSources } from '@/lib/partner-website/promotions/partner-sale-icon-generate'
import { partnerShopSaleIconSourceUrls } from '@/lib/partner-website/promotions/partner-sale-icon'

export type PartnerSaleIconCronResult = {
  partners: number
  created: number
  reused: number
  failed: number
  skipped: number
}

/** Same cron as marketing banners: next same-day-same-month sale, one engine. */
export async function ensureDailyPartnerSaleIcons(input?: {
  limitPartners?: number
  maxGenerate?: number
}): Promise<PartnerSaleIconCronResult> {
  const result: PartnerSaleIconCronResult = {
    partners: 0,
    created: 0,
    reused: 0,
    failed: 0,
    skipped: 0,
  }
  const partnerIds = await listWebsitePartnerIdsForMarketingBannersFromPg(input?.limitPartners ?? 40)
  result.partners = partnerIds.length
  let generated = 0
  const maxGenerate = Math.max(1, Math.min(8, input?.maxGenerate ?? 4))

  for (const partnerId of partnerIds) {
    if (generated >= maxGenerate) break
    const saleConfig = await fetchPartnerSaleCalendarConfigFromPg(partnerId).catch(() => null)
    if (!saleConfig?.enabled || saleConfig.saleIconAuto === false) {
      result.skipped += 1
      continue
    }
    const upcoming = listUpcomingPartnerSaleEvents({ settings: saleConfig, limit: 12 })
    const saleEvent = upcoming.find((event) => event.sameDayMonth)
    if (!saleEvent) {
      result.skipped += 1
      continue
    }
    const sources = await loadPartnerSaleIconSources(partnerId)
    const refs = partnerShopSaleIconSourceUrls({
      faviconUrl: sources.faviconUrl,
      pwaIconUrl: sources.pwaIconUrl,
      logoUrl: sources.logoUrl,
    })
    if (!refs.length) {
      result.skipped += 1
      continue
    }
    const existing = await findReadyPartnerSaleIconFromPg({
      partnerId,
      day: saleEvent.day,
      month: saleEvent.month,
    })
    const sourcePwa = sources.pwaIconUrl || sources.faviconUrl
    if (
      existing?.imageUrl &&
      existing.sourceFaviconUrl === sources.faviconUrl &&
      existing.sourcePwaIconUrl === sourcePwa
    ) {
      result.reused += 1
      continue
    }
    const ownerUserId = await fetchMessagingPartnerOwnerUserIdFromPg(partnerId)
    const created = await generatePartnerSaleIcon({
      partnerId,
      day: saleEvent.day,
      month: saleEvent.month,
      discountPercent: saleEvent.discountPercent,
      actorUserId: ownerUserId,
      chargeCredits: false,
    })
    if (created.ok) {
      if (existing?.imageUrl && created.asset.imageUrl === existing.imageUrl) {
        result.reused += 1
      } else {
        result.created += 1
        generated += 1
        const meta = await fetchPartnerWebsitePublishMetaFromPg(partnerId).catch(() => null)
        if (meta?.siteSlug) bumpSiteCacheLater(meta.siteSlug)
      }
      continue
    }
    result.failed += 1
  }

  return result
}
