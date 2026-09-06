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

export type PartnerMarketingBannerCronResult = {
  partners: number
  birthday: { created: number; reused: number; failed: number }
  sale: { created: number; reused: number; failed: number }
  warehouse: { created: number; reused: number; failed: number; skipped: number }
}

function emptyCounts() {
  return { created: 0, reused: 0, failed: 0 }
}

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

  for (const partnerId of partnerIds) {
    if (generated >= maxGenerate) break
    const ownerUserId = await fetchMessagingPartnerOwnerUserIdFromPg(partnerId)

    const promo = await fetchBirthdayPromoForPartnerFromPg(partnerId)
    if (promo?.enabled) {
      const percent = Math.max(0, Math.min(100, Math.floor(Number(promo.discount_percent) || 0)))
      if (percent > 0) {
        const dates = await listBirthdayDatesWithCustomersFromPg({ partnerId, today })
        for (const target of dates) {
          if (generated >= maxGenerate) break
          const existing = await findActivePartnerMarketingBannerFromPg({
            partnerId,
            kind: 'birthday',
            day: target.getDate(),
            month: target.getMonth() + 1,
            discountPercent: percent,
          })
          if (existing) {
            result.birthday.reused += 1
            continue
          }
          const created = await generatePartnerMarketingBanner({
            partnerId,
            kind: 'birthday',
            day: target.getDate(),
            month: target.getMonth() + 1,
            discountPercent: percent,
            actorUserId: ownerUserId,
            chargeCredits: false,
          })
          if (created.ok) {
            result.birthday.created += 1
            generated += 1
          } else {
            result.birthday.failed += 1
          }
        }
      }
    }

    if (generated >= maxGenerate) break
    const saleConfig = await fetchPartnerSaleCalendarConfigFromPg(partnerId)
    const upcoming = listUpcomingPartnerSaleEvents({ settings: saleConfig, limit: 12 })
    const saleEvent = upcoming.find((event) => event.sameDayMonth)
    if (saleEvent) {
      const existingSale = await findActivePartnerMarketingBannerFromPg({
        partnerId,
        kind: 'sale',
        day: saleEvent.day,
        month: saleEvent.month,
        discountPercent: saleEvent.discountPercent,
      })
      if (existingSale) {
        result.sale.reused += 1
      } else {
        const createdSale = await generatePartnerMarketingBanner({
          partnerId,
          kind: 'sale',
          day: saleEvent.day,
          month: saleEvent.month,
          discountPercent: saleEvent.discountPercent,
          actorUserId: ownerUserId,
          chargeCredits: false,
        })
        if (createdSale.ok) {
          result.sale.created += 1
          generated += 1
        } else {
          result.sale.failed += 1
        }
      }
    }

    if (generated >= maxGenerate) break
    const warehousePct = Math.max(0, Number(saleConfig.clearanceDiscountPercent) || 0)
    if (!saleConfig.clearanceEnabled || warehousePct <= 0) {
      result.warehouse.skipped += 1
    } else {
      const existingWarehouse = await findActivePartnerMarketingBannerFromPg({
        partnerId,
        kind: 'warehouse',
        day: 0,
        month: 0,
        discountPercent: warehousePct,
      })
      if (existingWarehouse) {
        result.warehouse.reused += 1
      } else {
        const createdWarehouse = await generatePartnerMarketingBanner({
          partnerId,
          kind: 'warehouse',
          day: 0,
          month: 0,
          discountPercent: warehousePct,
          actorUserId: ownerUserId,
          chargeCredits: false,
        })
        if (createdWarehouse.ok) {
          result.warehouse.created += 1
          generated += 1
        } else {
          result.warehouse.failed += 1
        }
      }
    }
  }

  return result
}
