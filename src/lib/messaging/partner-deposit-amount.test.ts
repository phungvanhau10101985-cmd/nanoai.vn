import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolvePercentDepositAmount } from './partner-deposit-amount'

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
