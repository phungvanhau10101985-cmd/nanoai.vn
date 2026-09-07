/**
 * Personalized flash sale — port of 188 `flash_sale.py`.
 * Same Chinese source shop + L3 of last 8 views; 12 deals / 10 min; 5–6%.
 * Not warehouse clearance. Flash replaces calendar site-sale on those SKUs.
 */

import { createHash } from 'node:crypto'
import { PARTNER_SALE_DEFAULT_TIMEZONE } from '@/lib/partner-website/promotions/partner-sale-calendar'
import type { PartnerSiteSalePricing } from '@/lib/partner-website/promotions/partner-site-sale-display'

export const FLASH_SALE_EVENT_LABEL = 'Flash sale'
export const FLASH_SALE_KIND = 'flash' as const
export const FLASH_SALE_RECENT_VIEWS = 8
export const FLASH_SALE_MAX_COUNT = 12
export const FLASH_SALE_MIN_PERCENT = 5
export const FLASH_SALE_MAX_PERCENT = 6
export const FLASH_SALE_SLOT_MINUTES = 10
export const FLASH_SALE_CANDIDATE_LIMIT = 240
export const FLASH_SALE_MIN_SHOW = 4

export type PartnerFlashSaleSlot = {
  key: string
  startAt: Date
  endAt: Date
}

export type PartnerFlashSaleAssignment = {
  productIds: string[]
  percentById: Record<string, number>
  slot: PartnerFlashSaleSlot
}

function validTimezone(raw: string | null | undefined): string {
  const value = String(raw || '').trim() || PARTNER_SALE_DEFAULT_TIMEZONE
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date())
    return value
  } catch {
    return PARTNER_SALE_DEFAULT_TIMEZONE
  }
}

function tzOffsetMs(at: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return asUtc - at.getTime()
}

function localMidnightUtc(at: Date, timezone: string): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0)
  const guess = Date.UTC(get('year'), get('month') - 1, get('day'), 0, 0, 0)
  return new Date(guess - tzOffsetMs(new Date(guess), timezone))
}

function localDateKey(at: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at)
}

export function resolvePartnerFlashSaleSlot(
  now: Date = new Date(),
  timezone: string = PARTNER_SALE_DEFAULT_TIMEZONE
): PartnerFlashSaleSlot {
  const tz = validTimezone(timezone)
  const midnight = localMidnightUtc(now, tz)
  const elapsed = Math.max(0, Math.floor((now.getTime() - midnight.getTime()) / 1000))
  const slotSeconds = FLASH_SALE_SLOT_MINUTES * 60
  const index = Math.floor(elapsed / slotSeconds)
  const startAt = new Date(midnight.getTime() + index * slotSeconds * 1000)
  const dayEnd = new Date(midnight.getTime() + 86_400_000)
  let endAt = new Date(startAt.getTime() + slotSeconds * 1000)
  if (endAt.getTime() > dayEnd.getTime()) endAt = dayEnd
  return {
    key: `${localDateKey(startAt, tz)}:${index}`,
    startAt,
    endAt,
  }
}

export function emptyPartnerFlashSaleAssignment(
  slot: PartnerFlashSaleSlot
): PartnerFlashSaleAssignment {
  return { productIds: [], percentById: {}, slot }
}

export function partnerFlashSaleIdentityKey(accountKey: string | null | undefined): string | null {
  const key = String(accountKey || '').trim()
  return key || null
}

export function partnerFlashSaleStableSeed(...parts: unknown[]): number {
  const raw = parts.map((p) => String(p)).join('|')
  const digest = createHash('md5').update(raw, 'utf8').digest('hex')
  return Number.parseInt(digest.slice(0, 8), 16)
}

export function partnerFlashSalePercentForProduct(productId: string, slotKey: string): number {
  const span = FLASH_SALE_MAX_PERCENT - FLASH_SALE_MIN_PERCENT + 1
  return FLASH_SALE_MIN_PERCENT + (partnerFlashSaleStableSeed(slotKey, String(productId).toLowerCase()) % span)
}

export function pickEvenShopProducts<T>(
  shopQueues: Record<string, T[]>,
  shopOrder: string[],
  input: { target: number; seed: number; idOf: (item: T) => string }
): T[] {
  const target = Math.max(0, Math.floor(input.target))
  if (target <= 0 || !shopOrder.length) return []
  let rng = input.seed >>> 0
  const next = () => {
    rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0
    return rng
  }
  const queues: Record<string, T[]> = {}
  const order: string[] = []
  for (const shop of shopOrder) {
    const key = String(shop || '').trim().toLowerCase()
    if (!key || key in queues) continue
    const items = [...(shopQueues[shop] || shopQueues[key] || [])]
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = next() % (i + 1)
      const tmp = items[i]
      items[i] = items[j]
      items[j] = tmp
    }
    if (items.length) {
      queues[key] = items
      order.push(key)
    }
  }
  if (!order.length) return []
  const cap = Math.max(1, Math.ceil(target / order.length))
  const counts: Record<string, number> = Object.fromEntries(order.map((shop) => [shop, 0]))
  const picked: T[] = []
  const seen = new Set<string>()

  const take = (shop: string): boolean => {
    const queue = queues[shop]
    if (!queue?.length) return false
    while (queue.length) {
      const item = queue.shift() as T
      const id = String(input.idOf(item) || '').trim().toLowerCase()
      if (id) {
        if (seen.has(id)) continue
        seen.add(id)
      }
      picked.push(item)
      counts[shop] = (counts[shop] ?? 0) + 1
      return true
    }
    return false
  }

  while (picked.length < target) {
    let progressed = false
    for (const shop of order) {
      if (picked.length >= target) break
      if ((counts[shop] ?? 0) >= cap) continue
      if (take(shop)) progressed = true
    }
    if (progressed) continue
    const leftover = order.filter((shop) => (queues[shop] || []).length > 0)
    if (!leftover.length) break
    for (const shop of leftover) {
      if (picked.length >= target) break
      take(shop)
    }
  }
  return picked.slice(0, target)
}

export function applyPartnerFlashPercentToPrice(
  listPrice: number,
  percent: number,
  countdownTo: Date | string | null
): PartnerSiteSalePricing {
  const list = Math.max(0, Math.round(Number(listPrice) || 0))
  const pct = Math.max(
    FLASH_SALE_MIN_PERCENT,
    Math.min(FLASH_SALE_MAX_PERCENT, Math.round(Number(percent) || FLASH_SALE_MIN_PERCENT))
  )
  const savings = Math.max(0, Math.round((list * pct) / 100))
  const displayPrice = Math.max(0, list - savings)
  const countdown =
    countdownTo instanceof Date
      ? countdownTo.toISOString()
      : countdownTo
        ? String(countdownTo)
        : null
  return {
    kind: FLASH_SALE_KIND,
    listPrice: list,
    displayPrice,
    savingsAmount: savings,
    percent: pct,
    phase: 'active',
    expectedSalePrice: null,
    eventLabel: FLASH_SALE_EVENT_LABEL,
    eventDate: null,
    countdownTo: countdown,
  }
}

export function isPartnerFlashSalePricing(
  sale?: Pick<PartnerSiteSalePricing, 'kind' | 'eventLabel'> | null
): boolean {
  if (!sale) return false
  if (sale.kind === FLASH_SALE_KIND) return true
  return String(sale.eventLabel || '').trim().toLowerCase() === FLASH_SALE_EVENT_LABEL.toLowerCase()
}

export function partnerFlashSaleProductId(product: {
  id?: string | null
  inventory_id?: string | null
  inventoryId?: string | null
}): string {
  return String(product.id || product.inventory_id || product.inventoryId || '')
    .trim()
    .toLowerCase()
}

export function applyPartnerFlashSaleToProduct<
  T extends {
    id?: string | null
    inventory_id?: string | null
    inventoryId?: string | null
    isClearance?: boolean | null
    priceAmount?: number | null
    salePriceAmount?: number | null
    saleStartsAt?: string | null
    saleEndsAt?: string | null
    siteSale?: PartnerSiteSalePricing | null
    siteSalePhase?: 'off' | 'teaser' | 'active' | null
    siteSalePercent?: number | null
    siteSaleExpectedPrice?: number | null
  },
>(product: T, assignment: PartnerFlashSaleAssignment | null | undefined): T {
  if (!assignment?.productIds.length) return product
  if (product.isClearance === true) return product
  const id = partnerFlashSaleProductId(product)
  if (!id) return product
  const percent = assignment.percentById[id] ?? assignment.percentById[partnerFlashSaleProductId({ id })]
  if (!percent) return product
  const list = Math.max(
    0,
    Math.round(
      Number(product.priceAmount) ||
        Number(product.siteSale?.listPrice) ||
        0
    )
  )
  if (list <= 0) return product
  const siteSale = applyPartnerFlashPercentToPrice(list, percent, assignment.slot.endAt)
  return {
    ...product,
    salePriceAmount: siteSale.displayPrice,
    saleStartsAt: null,
    saleEndsAt: assignment.slot.endAt.toISOString(),
    siteSale,
    siteSalePhase: 'active',
    siteSalePercent: siteSale.percent,
    siteSaleExpectedPrice: null,
  }
}

export function applyPartnerFlashSaleToProducts<T extends Parameters<typeof applyPartnerFlashSaleToProduct>[0]>(
  products: T[],
  assignment: PartnerFlashSaleAssignment | null | undefined
): T[] {
  if (!assignment?.productIds.length) return products
  return products.map((product) => applyPartnerFlashSaleToProduct(product, assignment))
}
