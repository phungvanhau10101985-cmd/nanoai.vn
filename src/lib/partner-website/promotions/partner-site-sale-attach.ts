import { fetchPartnerSaleCalendarConfigFromPg } from '@/lib/db/messaging-partner-sale-calendar-pg'
import { resolvePartnerStorefrontSaleCalendarFromPg } from '@/lib/db/messaging-partner-feature-test-pg'
import { resolveActiveBirthdayDiscountPercentForCustomer } from '@/lib/db/messaging-partner-birthday-promo-pg'
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

export async function loadPartnerStorefrontBirthdayPercent(input: {
  partnerId: string
  linkedUserId?: string | null
  emailNormalized?: string | null
}): Promise<number> {
  const percent = await resolveActiveBirthdayDiscountPercentForCustomer({
    partnerId: input.partnerId,
    linkedUserId: input.linkedUserId,
    emailNormalized: input.emailNormalized,
  })
  return Math.max(0, Math.round(Number(percent) || 0))
}

export function withPartnerBirthdayOffer<T extends { isClearance?: boolean }>(
  product: T,
  percent: number | null | undefined
): T & { birthdayOfferPercent: number } {
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
): Promise<Array<T & { birthdayOfferPercent: number }>> {
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
  const [withFlash, birthdayPercent] = await Promise.all([
    overlayPartnerFlashSaleOnProducts({
      partnerId: input.partnerId,
      accountKey: input.accountKey,
      timezone: overlay?.state.timezone,
      products: sold,
    }),
    loadPartnerStorefrontBirthdayPercent({
      partnerId: input.partnerId,
      linkedUserId: input.linkedUserId,
      emailNormalized: input.emailNormalized,
    }),
  ])
  return withFlash.map((product) => attachPartnerBirthdayOffer(product, birthdayPercent))
}
