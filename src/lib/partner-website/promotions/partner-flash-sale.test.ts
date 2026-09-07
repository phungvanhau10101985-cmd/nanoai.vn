import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyPartnerFlashPercentToPrice,
  applyPartnerFlashSaleToProduct,
  FLASH_SALE_MAX_PERCENT,
  FLASH_SALE_MIN_PERCENT,
  FLASH_SALE_SLOT_MINUTES,
  partnerFlashSalePercentForProduct,
  pickEvenShopProducts,
  resolvePartnerFlashSaleSlot,
} from '@/lib/partner-website/promotions/partner-flash-sale'
import { applyPartnerFlashSaleUnitPrice } from '@/lib/db/messaging-partner-flash-sale-pg'
import { partnerSiteSaleDateBadgeLabel } from '@/lib/partner-website/promotions/partner-site-sale-display'

test('flash slot is 10 minutes from local midnight', () => {
  const slot = resolvePartnerFlashSaleSlot(new Date('2026-09-07T03:05:00.000Z'), 'Asia/Ho_Chi_Minh')
  assert.match(slot.key, /^2026-09-07:\d+$/)
  assert.equal(slot.endAt.getTime() - slot.startAt.getTime(), FLASH_SALE_SLOT_MINUTES * 60 * 1000)
})

test('flash percent is stable 5–6 per product+slot', () => {
  const a = partnerFlashSalePercentForProduct('abc', '2026-09-07:72')
  const b = partnerFlashSalePercentForProduct('ABC', '2026-09-07:72')
  assert.equal(a, b)
  assert.ok(a >= FLASH_SALE_MIN_PERCENT && a <= FLASH_SALE_MAX_PERCENT)
  const other = partnerFlashSalePercentForProduct('abc', '2026-09-07:73')
  assert.ok(other >= FLASH_SALE_MIN_PERCENT && other <= FLASH_SALE_MAX_PERCENT)
})

test('pickEvenShopProducts round-robins shops', () => {
  const picked = pickEvenShopProducts(
    {
      shopA: [{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }],
      shopB: [{ id: 'b1' }, { id: 'b2' }],
    },
    ['shopA', 'shopB'],
    { target: 4, seed: 1, idOf: (row) => row.id }
  )
  const ids = picked.map((row) => row.id)
  assert.equal(ids.length, 4)
  assert.equal(new Set(ids).size, 4)
  assert.ok(ids.some((id) => id.startsWith('a')))
  assert.ok(ids.some((id) => id.startsWith('b')))
})

test('flash replaces calendar price and skips clearance', () => {
  const endAt = new Date('2026-09-07T04:10:00.000Z')
  const assignment = {
    productIds: ['sku-1'],
    percentById: { 'sku-1': 6 },
    slot: { key: '2026-09-07:1', startAt: new Date('2026-09-07T04:00:00.000Z'), endAt },
  }
  const priced = applyPartnerFlashSaleToProduct(
    {
      id: 'sku-1',
      priceAmount: 1_000_000,
      salePriceAmount: 940_000,
      siteSale: {
        kind: 'calendar',
        listPrice: 1_000_000,
        displayPrice: 940_000,
        savingsAmount: 60_000,
        percent: 6,
        phase: 'active',
        expectedSalePrice: null,
        eventLabel: '9/9',
        eventDate: '2026-09-09',
        countdownTo: null,
      },
    },
    assignment
  )
  assert.equal(priced.siteSale?.kind, 'flash')
  assert.equal(priced.salePriceAmount, 940_000)
  assert.equal(priced.siteSale?.percent, 6)
  const flash = applyPartnerFlashPercentToPrice(1_000_000, 5, endAt)
  assert.equal(flash.displayPrice, 950_000)
  assert.equal(flash.kind, 'flash')
  const clearance = applyPartnerFlashSaleToProduct(
    { id: 'sku-1', priceAmount: 1_000_000, isClearance: true },
    assignment
  )
  assert.equal(clearance.siteSale, undefined)
  assert.equal(partnerSiteSaleDateBadgeLabel({ percent: 5, kind: 'flash' }), 'FLASH -5%')
})

test('flash unit price replaces calendar instead of stacking min', () => {
  const endAt = new Date('2026-09-07T04:10:00.000Z')
  const assignment = {
    productIds: ['sku-1'],
    percentById: { 'sku-1': 5 },
    slot: { key: '2026-09-07:1', startAt: new Date('2026-09-07T04:00:00.000Z'), endAt },
  }
  const list = 1_000_000
  const calendarEightPercent = 920_000
  const flashed = applyPartnerFlashSaleUnitPrice({
    listUnitPrice: list,
    currentEffective: calendarEightPercent,
    inventoryId: 'sku-1',
    assignment,
  })
  assert.equal(flashed, 950_000)
  assert.equal(
    applyPartnerFlashSaleUnitPrice({
      listUnitPrice: list,
      currentEffective: calendarEightPercent,
      isClearance: true,
      inventoryId: 'sku-1',
      assignment,
    }),
    calendarEightPercent
  )
})
