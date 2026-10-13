import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  orderValueMeetsDepositFloor,
  partialDepositPercentForPrices,
  resolvePercentDepositAmount,
  unitPriceMeetsDepositFloor,
} from './partner-deposit-amount'

describe('resolvePercentDepositAmount', () => {
  it('keeps a saved 10 percent when the raw amount is already above 100_000', () => {
    assert.equal(resolvePercentDepositAmount(1_181_500, 10), 118_150)
  })

  it('raises a percent deposit up to 100_000 without changing the saved percent', () => {
    assert.equal(resolvePercentDepositAmount(400_000, 10), 100_000)
  })

  it('caps the floor at the goods total when the order is smaller than 100_000', () => {
    assert.equal(resolvePercentDepositAmount(80_000, 10), 80_000)
  })

  it('does not turn 10 into 30', () => {
    assert.equal(resolvePercentDepositAmount(1_000_000, 10), 100_000)
    assert.notEqual(resolvePercentDepositAmount(1_000_000, 10), 300_000)
  })

  it('charges the full goods total at 100 percent', () => {
    assert.equal(resolvePercentDepositAmount(250_000, 100), 250_000)
  })

  it('charges nothing at 0 percent', () => {
    assert.equal(resolvePercentDepositAmount(250_000, 0), 0)
  })
})

describe('high unit price deposit floor', () => {
  const rule = { thresholdVnd: 3_000_000, minPercent: 30 }

  it('starts at 3_000_000 on the order value', () => {
    assert.equal(orderValueMeetsDepositFloor(2_999_999, rule), false)
    assert.equal(orderValueMeetsDepositFloor(3_000_000, rule), true)
    assert.equal(unitPriceMeetsDepositFloor(3_000_000, rule), true)
  })

  it('raises the partial percent when the order total meets the threshold', () => {
    assert.equal(
      partialDepositPercentForPrices({
        shopPercent: 10,
        unitPrices: [1_000_000, 1_000_000, 1_000_000],
        thresholdVnd: 3_000_000,
        minPercent: 30,
      }),
      30
    )
  })

  it('keeps the shop percent when the lines stay under 3_000_000 together', () => {
    assert.equal(
      partialDepositPercentForPrices({
        shopPercent: 10,
        unitPrices: [1_000_000, 1_000_000],
        thresholdVnd: 3_000_000,
        minPercent: 30,
      }),
      10
    )
  })

  it('keeps a higher shop percent', () => {
    assert.equal(
      partialDepositPercentForPrices({
        shopPercent: 50,
        unitPrices: [4_000_000],
        thresholdVnd: 3_000_000,
        minPercent: 30,
      }),
      50
    )
  })

  it('turns off when the threshold or percent is 0', () => {
    assert.equal(unitPriceMeetsDepositFloor(9_000_000, { thresholdVnd: 0, minPercent: 30 }), false)
    assert.equal(
      partialDepositPercentForPrices({
        shopPercent: 10,
        unitPrices: [9_000_000],
        thresholdVnd: 3_000_000,
        minPercent: 0,
      }),
      10
    )
  })
})
