import { getAuthUserEmailFromPg } from '@/lib/db/auth-user-email-pg'
import { fetchBirthdayPromoForPartnerFromPg } from '@/lib/db/messaging-partner-birthday-promo-pg'
import { fetchPartnerCustomerProfileByEmailFromPg } from '@/lib/db/messaging-partner-customer-profiles-pg'
import { fetchGuestAccountEmailByIdPg } from '@/lib/db/messaging-guest-pg'
import {
  findActivePartnerMarketingBannerFromPg,
  findTestPartnerBirthdayBannerFromPg,
  type PartnerMarketingBannerAssetRow,
} from '@/lib/db/messaging-partner-marketing-banner-pg'
import {
  resolvePartnerBirthdayFeatureTestPercentFromPg,
  resolvePartnerStorefrontSaleCalendarFromPg,
} from '@/lib/db/messaging-partner-feature-test-pg'
import { fetchNanoaiChatProfileFromPg } from '@/lib/db/profiles-repo'
import {
  daysUntilNextBirthday,
  isInBirthdayOfferWindow,
  nextBirthdayIsoFromProfileYmd,
} from '@/lib/messaging/birthday-promo-interest-inventory-ids'
import type { WebLocale } from '@/lib/i18n/config'
import { partnerSiteProductsPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import { birthdayPercentForFeatureTest } from '@/lib/partner-website/promotions/partner-feature-test'
import {
  partnerMarketingBannerGreeting,
  type PartnerMarketingBannerPublicItem,
} from '@/lib/partner-website/promotions/partner-marketing-banner'

function toPublicItem(
  row: PartnerMarketingBannerAssetRow,
  input: {
    siteSlug: string
    eventDate?: string | null
    greeting?: string | null
    isTest?: boolean
    eventLabel?: string | null
  }
): PartnerMarketingBannerPublicItem | null {
  if (!row.image_url) return null
  return {
    id: row.id,
    kind: row.kind,
    campaign_key: row.campaign_key,
    date_key: row.date_key,
    discount_percent: row.discount_percent,
    image_url: row.image_url,
    aspect_ratio: row.aspect_ratio,
    event_date: input.eventDate ?? null,
    greeting: input.greeting ?? null,
    version: row.version,
    href: partnerSiteProductsPath(input.siteSlug),
    is_test: input.isTest === true,
    event_label: input.eventLabel ?? null,
  }
}

async function resolveVisitorEmailForBanners(input: {
  partnerId: string
  linkedUserId?: string | null
  guestAccountId?: string | null
}): Promise<string | null> {
  const linkedUserId = String(input.linkedUserId ?? '').trim()
  if (linkedUserId) {
    const email = (await getAuthUserEmailFromPg(linkedUserId))?.trim().toLowerCase() || ''
    if (email) return email
  }
  const guestAccountId = String(input.guestAccountId ?? '').trim()
  if (guestAccountId) {
    const guest = await fetchGuestAccountEmailByIdPg(input.partnerId, guestAccountId)
    return guest?.emailNormalized?.trim().toLowerCase() || null
  }
  return null
}

export async function resolvePartnerBirthdayBannerContext(input: {
  partnerId: string
  linkedUserId?: string | null
  guestAccountId?: string | null
}): Promise<{
  active: boolean
  percent: number
  nextBirthdayIso: string | null
  day: number
  month: number
  displayName: string
} | null> {
  const promo = await fetchBirthdayPromoForPartnerFromPg(input.partnerId)
  if (!promo?.enabled) return null
  const percent = Math.max(0, Math.min(100, Math.floor(Number(promo.discount_percent) || 0)))
  if (percent <= 0) return null

  let birthDate = ''
  let displayName = ''
  const linkedUserId = String(input.linkedUserId ?? '').trim()
  const guestAccountId = String(input.guestAccountId ?? '').trim()

  if (linkedUserId) {
    const nano = await fetchNanoaiChatProfileFromPg(linkedUserId)
    birthDate = String(nano?.birthDate ?? '').trim().slice(0, 10)
    const email = (await getAuthUserEmailFromPg(linkedUserId))?.toLowerCase() ?? ''
    if (email) {
      const profile = await fetchPartnerCustomerProfileByEmailFromPg({
        partnerId: input.partnerId,
        emailNormalized: email,
      })
      displayName = profile?.customer_name?.trim() || ''
      if (!birthDate) birthDate = profile?.date_of_birth?.trim().slice(0, 10) || ''
    }
  } else if (guestAccountId) {
    const guest = await fetchGuestAccountEmailByIdPg(input.partnerId, guestAccountId)
    const email = guest?.emailNormalized || ''
    if (email) {
      const profile = await fetchPartnerCustomerProfileByEmailFromPg({
        partnerId: input.partnerId,
        emailNormalized: email,
      })
      birthDate = profile?.date_of_birth?.trim().slice(0, 10) || ''
      displayName = profile?.customer_name?.trim() || ''
    }
  }

  if (!birthDate) return null
  const daysUntil = daysUntilNextBirthday(birthDate)
  if (daysUntil == null) return null
  if (!isInBirthdayOfferWindow(daysUntil, promo.offer_days_before_max, promo.offer_days_before_min)) {
    return null
  }
  const nextIso = nextBirthdayIsoFromProfileYmd(birthDate)
  if (!nextIso) return null
  const month = Number(nextIso.slice(5, 7))
  const day = Number(nextIso.slice(8, 10))
  return {
    active: true,
    percent,
    nextBirthdayIso: nextIso,
    day,
    month,
    displayName,
  }
}

export async function resolveCurrentPartnerMarketingBanners(input: {
  partnerId: string
  siteSlug: string
  locale?: WebLocale
  linkedUserId?: string | null
  guestAccountId?: string | null
}): Promise<PartnerMarketingBannerPublicItem[]> {
  const items: PartnerMarketingBannerPublicItem[] = []
  const locale = input.locale ?? 'vi'
  const visitorEmail = await resolveVisitorEmailForBanners({
    partnerId: input.partnerId,
    linkedUserId: input.linkedUserId,
    guestAccountId: input.guestAccountId,
  })

  const birthday = await resolvePartnerBirthdayBannerContext({
    partnerId: input.partnerId,
    linkedUserId: input.linkedUserId,
    guestAccountId: input.guestAccountId,
  })
  if (birthday) {
    const asset = await findActivePartnerMarketingBannerFromPg({
      partnerId: input.partnerId,
      kind: 'birthday',
      day: birthday.day,
      month: birthday.month,
      discountPercent: birthday.percent,
    })
    const publicItem = asset
      ? toPublicItem(asset, {
          siteSlug: input.siteSlug,
          eventDate: birthday.nextBirthdayIso,
          greeting: partnerMarketingBannerGreeting(locale, birthday.displayName),
        })
      : null
    if (publicItem) items.push(publicItem)
  } else {
    const promo = await fetchBirthdayPromoForPartnerFromPg(input.partnerId)
    const testPercent = await resolvePartnerBirthdayFeatureTestPercentFromPg({
      partnerId: input.partnerId,
      visitorEmail,
      configuredPercent: promo?.discount_percent,
    })
    if (testPercent != null) {
      const found = await findTestPartnerBirthdayBannerFromPg({
        partnerId: input.partnerId,
        discountPercent: birthdayPercentForFeatureTest(promo?.discount_percent),
      })
      const profile = visitorEmail
        ? await fetchPartnerCustomerProfileByEmailFromPg({
            partnerId: input.partnerId,
            emailNormalized: visitorEmail,
          })
        : null
      const publicItem = found
        ? toPublicItem(found.asset, {
            siteSlug: input.siteSlug,
            eventDate: found.eventDate,
            greeting: `[Test] ${partnerMarketingBannerGreeting(locale, profile?.customer_name ?? '')}`,
            isTest: true,
            eventLabel: `[Test] CMSN ${Number(found.eventDate.slice(8, 10))}/${Number(found.eventDate.slice(5, 7))}`,
          })
        : null
      if (publicItem) items.push(publicItem)
    }
  }

  const sale = await resolvePartnerStorefrontSaleCalendarFromPg({
    partnerId: input.partnerId,
    visitorEmail,
  })
  if (sale.phase !== 'off') {
    const saleDate = sale.saleDate
    const month = Number(saleDate.slice(5, 7))
    const day = Number(saleDate.slice(8, 10))
    if (day === month) {
      const asset = await findActivePartnerMarketingBannerFromPg({
        partnerId: input.partnerId,
        kind: 'sale',
        day,
        month,
        discountPercent: sale.discountPercent,
      })
      const publicItem = asset
        ? toPublicItem(asset, {
            siteSlug: input.siteSlug,
            eventDate: saleDate,
            greeting: sale.isTest ? sale.eventLabel : null,
            isTest: sale.isTest,
            eventLabel: sale.eventLabel,
          })
        : null
      if (publicItem) items.push(publicItem)
    }
  }

  return items
}
