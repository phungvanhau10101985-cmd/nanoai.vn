import { fetchPartnerSaleCalendarConfigFromPg } from '@/lib/db/messaging-partner-sale-calendar-pg'
import { resolvePartnerStorefrontSaleCalendarFromPg } from '@/lib/db/messaging-partner-feature-test-pg'
import { resolveActiveBirthdayOfferForCustomer } from '@/lib/db/messaging-partner-birthday-promo-pg'
import { overlayPartnerFlashSaleOnProducts } from '@/lib/db/messaging-partner-flash-sale-pg'
import {
  applyPartnerSiteSaleToShopProduct,
  attachPartnerBirthdayOffer,
  type PartnerSiteSaleProductInput,
} from '@/lib/partner-website/promotions/partner-site-sale-display'
import type { PartnerSaleCalendarState } from '@/lib/partner-website/promotions/partner-sale-calendar'

export type PartnerSiteSaleOverlay = {
  state: PartnerSaleCalendarState
  clearanceEnabled: boolean
  clearancePercent: number
}

export async function loadPartnerSiteSaleOverlay(partnerId: string): Promise<PartnerSiteSaleOverlay> {
  const settings = await fetchPartnerSaleCalendarConfigFromPg(partnerId)
  const state = await resolvePartnerStorefrontSaleCalendarFromPg({
    partnerId,
    settings,
  })
  return {
    state,
    clearanceEnabled: settings.clearanceEnabled,
    clearancePercent: settings.clearanceDiscountPercent,
  }
}

export async function loadPartnerStorefrontBirthdayOffer(input: {
  partnerId: string
  linkedUserId?: string | null
  emailNormalized?: string | null
  timezone?: string | null
}): Promise<{ percent: number; countdownTo: string | null }> {
  const offer = await resolveActiveBirthdayOfferForCustomer({
    partnerId: input.partnerId,
    linkedUserId: input.linkedUserId,
    emailNormalized: input.emailNormalized,
    timezone: input.timezone,
  })
  if (!offer) return { percent: 0, countdownTo: null }
  return { percent: Math.max(0, Math.round(Number(offer.percent) || 0)), countdownTo: offer.countdownTo }
}

export async function loadPartnerStorefrontBirthdayPercent(input: {
  partnerId: string
  linkedUserId?: string | null
  emailNormalized?: string | null
  timezone?: string | null
}): Promise<number> {
  return (await loadPartnerStorefrontBirthdayOffer(input)).percent
}

export function withPartnerBirthdayOffer<T extends { isClearance?: boolean }>(
  product: T,
  percent: number | { percent?: unknown; countdownTo?: string | null } | null | undefined
): T & {
  birthdayOfferPercent: number
  birthdayOfferEndsAt: string | null
  birthdayOffer: { percent: number; countdownTo: string | null } | null
} {
  return attachPartnerBirthdayOffer(product, percent)
}

export function withPartnerSiteSale<T extends PartnerSiteSaleProductInput>(
  product: T | null | undefined,
  overlay: PartnerSiteSaleOverlay | null | undefined
): T | null {
  if (!product) return null
  if (!overlay) return product
  return applyPartnerSiteSaleToShopProduct(product, overlay.state, {
    clearanceEnabled: overlay.clearanceEnabled,
    clearancePercent: overlay.clearancePercent,
  })
}

/** Calendar + flash + birthday hint on every storefront grid/PDP payload. Birthday does not change unit price. */
export async function applyPartnerStorefrontSaleFaces<T extends PartnerSiteSaleProductInput>(
  products: T[],
  input: {
    partnerId: string
    accountKey?: string | null
    linkedUserId?: string | null
    emailNormalized?: string | null
    overlay?: PartnerSiteSaleOverlay | null
  }
): Promise<
  Array<
    T & {
      birthdayOfferPercent: number
      birthdayOfferEndsAt: string | null
      birthdayOffer: { percent: number; countdownTo: string | null } | null
    }
  >
> {
  if (!products.length) return []
  const overlay = input.overlay ?? (await loadPartnerSiteSaleOverlay(input.partnerId).catch(() => null))
  const sold = overlay
    ? products.map((product) =>
        applyPartnerSiteSaleToShopProduct(product, overlay.state, {
          clearanceEnabled: overlay.clearanceEnabled,
          clearancePercent: overlay.clearancePercent,
        })
      )
    : products
  const [withFlash, birthdayOffer] = await Promise.all([
    overlayPartnerFlashSaleOnProducts({
      partnerId: input.partnerId,
      accountKey: input.accountKey,
      timezone: overlay?.state.timezone,
      products: sold,
    }),
    loadPartnerStorefrontBirthdayOffer({
      partnerId: input.partnerId,
      linkedUserId: input.linkedUserId,
      emailNormalized: input.emailNormalized,
      timezone: overlay?.state.timezone,
    }),
  ])
  return withFlash.map((product) => attachPartnerBirthdayOffer(product, birthdayOffer))
}
