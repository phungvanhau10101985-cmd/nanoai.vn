import { fetchPartnerSaleCalendarConfigFromPg } from '@/lib/db/messaging-partner-sale-calendar-pg'
import { resolvePartnerStorefrontSaleCalendarFromPg } from '@/lib/db/messaging-partner-feature-test-pg'
import {
  applyPartnerSiteSaleToShopProduct,
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
