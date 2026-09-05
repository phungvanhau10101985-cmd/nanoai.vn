import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery } from '@/lib/db/pg-query'
import { fetchPartnerSaleCalendarConfigFromPg } from '@/lib/db/messaging-partner-sale-calendar-pg'
import { parseVndFromPriceHint } from '@/lib/partner-website/shop/cart-line-utils'
import { resolvePartnerEffectiveUnitPrice } from '@/lib/partner-website/shop/partner-shop-flash-sale'
import {
  applyPartnerSiteSalePrice,
  resolvePartnerSaleCalendarState,
} from '@/lib/partner-website/promotions/partner-sale-calendar'
import type { PartnerSalePriceLine } from '@/lib/partner-website/promotions/partner-sale-pricing'

type InventoryPriceDbRow = {
  id: string
  price_amount: string | number | null
  price_hint: string
  sale_price_amount: string | number | null
  sale_starts_at: unknown
  sale_ends_at: unknown
  is_clearance: boolean
}

type GoogleLockDbRow = {
  inventory_id: string
  locked_unit_price: string | number
}

function money(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0
}

export type PartnerCheckoutPriceLineInput = {
  inventoryId: string | null
  quantity: number
  fallbackUnitPrice: number
}

export async function resolvePartnerCheckoutPriceLinesFromPg(input: {
  partnerId: string
  accountKey?: string | null
  lines: PartnerCheckoutPriceLineInput[]
  at?: Date
}): Promise<PartnerSalePriceLine[]> {
  const ids = [...new Set(input.lines.map((line) => line.inventoryId).filter((id): id is string => Boolean(id)))]
  if (!isPgConfigured() || ids.length === 0) {
    return input.lines.map((line) => ({
      inventoryId: line.inventoryId,
      quantity: line.quantity,
      listUnitPrice: money(line.fallbackUnitPrice),
      effectiveUnitPrice: money(line.fallbackUnitPrice),
    }))
  }
  const [rows, config, locks] = await Promise.all([
    pgQuery<InventoryPriceDbRow>(
      `select id::text, price_amount, coalesce(price_hint, '') as price_hint,
              sale_price_amount, sale_starts_at, sale_ends_at,
              coalesce(is_clearance, false) as is_clearance
       from public.messaging_partner_inventory
       where partner_id = $1::uuid and id = any($2::uuid[])`,
      [input.partnerId, ids]
    ).catch((error) => {
      if ((error as { code?: string })?.code !== '42703') throw error
      return pgQuery<InventoryPriceDbRow>(
        `select id::text, price_amount, coalesce(price_hint, '') as price_hint,
                sale_price_amount, sale_starts_at, sale_ends_at,
                false as is_clearance
         from public.messaging_partner_inventory
         where partner_id = $1::uuid and id = any($2::uuid[])`,
        [input.partnerId, ids]
      )
    }),
    fetchPartnerSaleCalendarConfigFromPg(input.partnerId),
    input.accountKey
      ? pgQuery<GoogleLockDbRow>(
          `select inventory_id::text, locked_unit_price
           from public.messaging_partner_google_discount_locks
           where partner_id = $1::uuid and account_key = $2 and expires_at > now()
             and inventory_id = any($3::uuid[])`,
          [input.partnerId, input.accountKey, ids]
        ).catch(() => [])
      : Promise.resolve([]),
  ])
  const byId = new Map(rows.map((row) => [row.id, row]))
  const lockById = new Map(locks.map((row) => [row.inventory_id, money(row.locked_unit_price)]))
  const calendarState = resolvePartnerSaleCalendarState({ settings: config, at: input.at })

  return input.lines.map((line) => {
    const row = line.inventoryId ? byId.get(line.inventoryId) : null
    const fallback = money(line.fallbackUnitPrice)
    const listUnitPrice =
      money(row?.price_amount) || parseVndFromPriceHint(row?.price_hint || '') || fallback
    if (!row) {
      return {
        inventoryId: line.inventoryId,
        quantity: line.quantity,
        listUnitPrice,
        effectiveUnitPrice: fallback || listUnitPrice,
      }
    }
    if (row.is_clearance && config.clearanceEnabled) {
      return {
        inventoryId: row.id,
        quantity: line.quantity,
        listUnitPrice,
        effectiveUnitPrice: Math.max(
          0,
          Math.round(listUnitPrice * (1 - config.clearanceDiscountPercent / 100))
        ),
        isClearance: true,
      }
    }
    const productSale =
      resolvePartnerEffectiveUnitPrice({
        priceAmount: listUnitPrice,
        salePriceAmount: row.sale_price_amount == null ? null : money(row.sale_price_amount),
        saleStartsAt: row.sale_starts_at ? String(row.sale_starts_at) : null,
        saleEndsAt: row.sale_ends_at ? String(row.sale_ends_at) : null,
      }, input.at?.getTime()) ?? listUnitPrice
    const calendarSale = applyPartnerSiteSalePrice(listUnitPrice, calendarState)
    const regularSale = Math.min(listUnitPrice, productSale, calendarSale)
    const googlePrice = lockById.get(row.id)
    // Parity 188: a valid Google pv2 lock owns line pricing for its 48-hour
    // lifetime; product/calendar sales are not stacked onto that line.
    const effectiveUnitPrice =
      googlePrice == null ? regularSale : Math.min(listUnitPrice, googlePrice)
    return {
      inventoryId: row.id,
      quantity: line.quantity,
      listUnitPrice,
      effectiveUnitPrice,
      googleDiscountAmount:
        googlePrice != null && googlePrice < listUnitPrice ? listUnitPrice - googlePrice : 0,
    }
  })
}
