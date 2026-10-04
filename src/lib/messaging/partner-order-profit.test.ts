import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  assembleProfitOrder,
  collectedGoodsVnd,
  goodsCnyMatchingListing,
  orderCostVnd,
  recognizedGoodsVnd,
  summarizeStoredImport,
} from './partner-order-profit'
import { estimateListingVndRounded, listingVndToCny } from './listing-import/taobao-cards-html-parse'

describe('partner order profit', () => {
  it('uses the price after sale, not shipping', () => {
    assert.equal(collectedGoodsVnd(1_000_000, 100_000, 880_000), 900_000)
    assert.equal(collectedGoodsVnd(0, 0, 490_000), 490_000)
  })

  it('keeps only the deposit on a returned order', () => {
    assert.equal(recognizedGoodsVnd(1_000_000, 300_000, false), 1_000_000)
    assert.equal(recognizedGoodsVnd(1_000_000, 300_000, true), 300_000)
    assert.equal(recognizedGoodsVnd(1_000_000, 0, true), 0)
  })

  it('costs china yuan and vietnam dong, with sale stock at 0', () => {
    const mixed = summarizeStoredImport([
      { quantity: 1, costCny: 80, costVnd: null, isWarehouse: false, isClearance: false },
      { quantity: 2, costCny: null, costVnd: 0, isWarehouse: true, isClearance: false },
    ])
    assert.ok(mixed)
    assert.equal(mixed.goodsCny, 80)
    assert.equal(mixed.goodsVnd, 0)
    assert.equal(mixed.usesChinaShip, true)
    assert.equal(
      orderCostVnd({
        goodsCny: mixed.goodsCny,
        goodsVnd: mixed.goodsVnd,
        usesChinaShip: true,
        shipChinaCny: 10,
        shipBorderCny: 0,
        shipHanoiVnd: 30_000,
        vndPerCny: 3580,
      }),
      80 * 3580 + 10 * 3580 + 30_000,
    )

    const both = summarizeStoredImport([
      { quantity: 1, costCny: 80, costVnd: 80 * 3580, isWarehouse: false, isClearance: false },
    ])
    assert.ok(both)
    assert.equal(both.goodsCny, 80)
    assert.equal(both.goodsVnd, 0)
    assert.equal(both.usesChinaShip, true)
    const atLaterRate = orderCostVnd({
      goodsCny: both.goodsCny,
      goodsVnd: both.goodsVnd,
      usesChinaShip: true,
      shipChinaCny: 0,
      shipBorderCny: 0,
      shipHanoiVnd: 0,
      vndPerCny: 3700,
    })
    assert.equal(atLaterRate, 80 * 3700)
    const vietnam = summarizeStoredImport([
      { quantity: 1, costCny: null, costVnd: 150000, isWarehouse: false, isClearance: false },
    ])
    assert.ok(vietnam)
    assert.equal(vietnam.goodsCny, 0)
    assert.equal(vietnam.goodsVnd, 150000)
    assert.equal(vietnam.usesChinaShip, false)
    assert.equal(
      orderCostVnd({
        goodsCny: vietnam.goodsCny,
        goodsVnd: vietnam.goodsVnd,
        usesChinaShip: false,
        shipChinaCny: 10,
        shipBorderCny: 0,
        shipHanoiVnd: 0,
        vndPerCny: 3700,
      }),
      150000,
    )

    const sale = summarizeStoredImport([
      { quantity: 1, costCny: null, costVnd: null, isWarehouse: false, isClearance: true },
    ])
    assert.ok(sale)
    assert.equal(sale.usesChinaShip, false)
    assert.equal(
      orderCostVnd({
        goodsCny: sale.goodsCny,
        goodsVnd: sale.goodsVnd,
        usesChinaShip: false,
        shipChinaCny: 10,
        shipBorderCny: 20,
        shipHanoiVnd: 30_000,
        vndPerCny: 3580,
      }),
      30_000,
    )
  })

  it('inverts a listing price when the catalog has no yuan', () => {
    const selling = estimateListingVndRounded(
      { price_cny_approx: 80, cny_exchange_multiplier: 3 },
      3580,
    )
    assert.ok(selling)
    const goods = goodsCnyMatchingListing(
      [{ quantity: 1, unitPriceVnd: selling, lineTotalVnd: selling, catalogRaw: null }],
      3580,
      selling,
    )
    assert.ok(goods != null && Math.abs(goods - 80) < 1.5)
    const labeled = goodsCnyMatchingListing(
      [{ quantity: 1, unitPriceVnd: selling, lineTotalVnd: selling, catalogRaw: 'giày tây nam g05' }],
      3580,
      selling,
    )
    assert.ok(labeled != null && Math.abs(labeled - 80) < 1.5)
  })

  it('assembles stored china cost and skips china ship on clearance', () => {
    const china = assembleProfitOrder(
      {
        orderId: '11111111-1111-1111-1111-111111111111',
        orderCode: 'DH1',
        depositedOn: '2026-10-01',
        subtotal: 1_000_000,
        discount: 0,
        amountAfterDiscount: 1_000_000,
        paidAmount: 300_000,
        returned: true,
        lines: [
          {
            quantity: 1,
            unitPriceVnd: 1_000_000,
            lineTotalVnd: 1_000_000,
            catalogRaw: null,
            costCny: 80,
            costVnd: 80 * 3580,
            isWarehouse: false,
            isClearance: false,
          },
        ],
        goodsCnyOverride: null,
        shipChinaOverride: null,
        shipBorderOverride: null,
        shipHanoiOverride: null,
      },
      3580,
    )
    assert.equal(china.revenueVnd, 300_000)
    assert.equal(china.uncollectedVnd, 700_000)
    assert.equal(china.catalogGoodsCny, 80)
    assert.equal(china.goodsVnd, 0)
    assert.equal(china.usesChinaShip, true)
    assert.equal(china.importStored, true)

    const clearance = assembleProfitOrder(
      {
        orderId: '22222222-2222-2222-2222-222222222222',
        orderCode: 'DH2',
        depositedOn: '2026-10-01',
        subtotal: 200_000,
        discount: 0,
        amountAfterDiscount: 200_000,
        paidAmount: 200_000,
        returned: false,
        lines: [
          {
            quantity: 1,
            unitPriceVnd: 200_000,
            lineTotalVnd: 200_000,
            catalogRaw: null,
            costCny: null,
            costVnd: null,
            isWarehouse: false,
            isClearance: true,
          },
        ],
        goodsCnyOverride: null,
        shipChinaOverride: null,
        shipBorderOverride: null,
        shipHanoiOverride: null,
      },
      3580,
    )
    assert.equal(clearance.usesChinaShip, false)
    assert.equal(clearance.goodsVnd, 0)
    assert.equal(
      orderCostVnd({
        goodsCny: clearance.catalogGoodsCny ?? 0,
        goodsVnd: clearance.goodsVnd,
        usesChinaShip: clearance.usesChinaShip,
        shipChinaCny: 10,
        shipBorderCny: 20,
        shipHanoiVnd: 30_000,
        vndPerCny: 3580,
      }),
      30_000,
    )
  })

  it('round-trips a listing price back to yuan', () => {
    const selling = estimateListingVndRounded(
      { price_cny_approx: 80, cny_exchange_multiplier: 3 },
      3580,
    )
    assert.ok(selling)
    const restored = listingVndToCny(selling, 3580)
    assert.ok(restored != null && Math.abs(restored - 80) < 1.5)
  })
})
