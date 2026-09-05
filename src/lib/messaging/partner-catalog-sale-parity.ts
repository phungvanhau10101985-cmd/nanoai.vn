import { fetchPartnerSaleCalendarConfigFromPg } from '@/lib/db/messaging-partner-sale-calendar-pg'
import {
  applyPartnerSiteSalePrice,
  resolvePartnerSaleCalendarState,
} from '@/lib/partner-website/promotions/partner-sale-calendar'
import type { CatalogFeedInventoryRow } from '@/lib/messaging/catalog-feed-shared'
import { catalogFeedPriceAmount, catalogFeedSalePriceAmount } from '@/lib/messaging/catalog-feed-shared'

export async function applyPartnerSaleParityToCatalogRows(
  partnerId: string,
  rows: CatalogFeedInventoryRow[]
): Promise<{
  rows: CatalogFeedInventoryRow[]
  phase: 'off' | 'teaser' | 'active'
  discountPercent: number
}> {
  const config = await fetchPartnerSaleCalendarConfigFromPg(partnerId)
  const state = resolvePartnerSaleCalendarState({ settings: config })
  const mapped = rows.map((row) => {
    const listPrice = catalogFeedPriceAmount(row)
    if (listPrice == null || listPrice <= 0) return row
    if (row.is_clearance && config.clearanceEnabled) {
      return {
        ...row,
        sale_price_amount: Math.max(
          0,
          Math.round(listPrice * (1 - config.clearanceDiscountPercent / 100))
        ),
        sale_starts_at: null,
        sale_ends_at: null,
      }
    }
    if (state.phase !== 'active') return row
    const calendarPrice = applyPartnerSiteSalePrice(listPrice, state)
    const currentSale = catalogFeedSalePriceAmount(row, listPrice)
    return {
      ...row,
      sale_price_amount: currentSale != null ? Math.min(calendarPrice, currentSale) : calendarPrice,
      sale_starts_at: null,
      sale_ends_at: null,
    }
  })
  return { rows: mapped, phase: state.phase, discountPercent: state.discountPercent }
}
