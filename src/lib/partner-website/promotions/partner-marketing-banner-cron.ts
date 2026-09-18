import { fetchBirthdayPromoForPartnerFromPg } from '@/lib/db/messaging-partner-birthday-promo-pg'
import { fetchMessagingPartnerOwnerUserIdFromPg } from '@/lib/db/messaging-partners-pg'
import {
  findActivePartnerMarketingBannerFromPg,
  listBirthdayDatesWithCustomersFromPg,
  listWebsitePartnerIdsForMarketingBannersFromPg,
} from '@/lib/db/messaging-partner-marketing-banner-pg'
import { fetchPartnerSaleCalendarConfigFromPg } from '@/lib/db/messaging-partner-sale-calendar-pg'
import { generatePartnerMarketingBanner } from '@/lib/partner-website/promotions/partner-marketing-banner-generate'
import { listUpcomingPartnerSaleEvents } from '@/lib/partner-website/promotions/partner-sale-calendar'
import type { PartnerMarketingBannerKind } from '@/lib/partner-website/promotions/partner-marketing-banner'

export type PartnerMarketingBannerCronResult = {
  partners: number
  birthday: { created: number; reused: number; failed: number }
  sale: { created: number; reused: number; failed: number }
  warehouse: { created: number; reused: number; failed: number; skipped: number }
}

function emptyCounts() {
  return { created: 0, reused: 0, failed: 0 }
}

/** 188 order: birthday dates with customers → next same-day-month sale → warehouse %. */
export async function ensureDailyPartnerMarketingBanners(input?: {
  limitPartners?: number
  maxGenerate?: number
}): Promise<PartnerMarketingBannerCronResult> {
  const result: PartnerMarketingBannerCronResult = {
    partners: 0,
    birthday: emptyCounts(),
    sale: emptyCounts(),
    warehouse: { ...emptyCounts(), skipped: 0 },
  }
  const partnerIds = await listWebsitePartnerIdsForMarketingBannersFromPg(input?.limitPartners ?? 40)
  result.partners = partnerIds.length
  let generated = 0
  const maxGenerate = Math.max(1, Math.min(8, input?.maxGenerate ?? 4))
  const today = new Date()

  async function tryCreate(inputCreate: {
    partnerId: string
    ownerUserId: string | null
    kind: Exclude<PartnerMarketingBannerKind, 'regular'>
    day: number
    month: number
    discountPercent: number
    bucket: 'birthday' | 'sale' | 'warehouse'
  }): Promise<void> {
    const existing = await findActivePartnerMarketingBannerFromPg({
      partnerId: inputCreate.partnerId,
      kind: inputCreate.kind,
      day: inputCreate.day,
      month: inputCreate.month,
      discountPercent: inputCreate.discountPercent,
    })
    if (existing) {
      result[inputCreate.bucket].reused += 1
      return
    }
    if (generated >= maxGenerate) return
    const created = await generatePartnerMarketingBanner({
      partnerId: inputCreate.partnerId,
      kind: inputCreate.kind,
      day: inputCreate.day,
      month: inputCreate.month,
      discountPercent: inputCreate.discountPercent,
      actorUserId: inputCreate.ownerUserId,
      chargeCredits: false,
    })
    if (created.ok) {
      result[inputCreate.bucket].created += 1
      generated += 1
      return
    }
    result[inputCreate.bucket].failed += 1
  }

  for (const partnerId of partnerIds) {
    if (generated >= maxGenerate) break
    const ownerUserId = await fetchMessagingPartnerOwnerUserIdFromPg(partnerId)
    const saleConfig = await fetchPartnerSaleCalendarConfigFromPg(partnerId)

    const promo = await fetchBirthdayPromoForPartnerFromPg(partnerId)
    if (promo?.enabled) {
      const percent = Math.max(0, Math.min(100, Math.floor(Number(promo.discount_percent) || 0)))
      if (percent > 0) {
        const dates = await listBirthdayDatesWithCustomersFromPg({ partnerId, today })
        for (const target of dates) {
          await tryCreate({
            partnerId,
            ownerUserId,
            kind: 'birthday',
            day: target.day,
            month: target.month,
            discountPercent: percent,
            bucket: 'birthday',
          })
        }
      }
    }

    const upcoming = listUpcomingPartnerSaleEvents({ settings: saleConfig, limit: 12 })
    const saleEvent = upcoming.find((event) => event.sameDayMonth)
    if (saleEvent) {
      await tryCreate({
        partnerId,
        ownerUserId,
        kind: 'sale',
        day: saleEvent.day,
        month: saleEvent.month,
        discountPercent: saleEvent.discountPercent,
        bucket: 'sale',
      })
    }

    const warehousePct = Math.max(0, Number(saleConfig.clearanceDiscountPercent) || 0)
    if (!saleConfig.clearanceEnabled || warehousePct <= 0) {
      result.warehouse.skipped += 1
    } else {
      await tryCreate({
        partnerId,
        ownerUserId,
        kind: 'warehouse',
        day: 0,
        month: 0,
        discountPercent: warehousePct,
        bucket: 'warehouse',
      })
    }
  }

  return result
}
