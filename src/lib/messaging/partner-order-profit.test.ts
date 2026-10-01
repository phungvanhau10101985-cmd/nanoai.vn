import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  collectedGoodsVnd,
  orderCostVnd,
  summarizeStoredImport,
} from './partner-order-profit'
import { estimateListingVndRounded, listingVndToCny } from './listing-import/taobao-cards-html-parse'

describe('partner order profit', () => {
  it('uses the price after sale, not shipping', () => {
    assert.equal(collectedGoodsVnd(900_000, 1_000_000), 900_000)
    assert.equal(collectedGoodsVnd(0, 800_000), 800_000)
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
