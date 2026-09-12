import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildCheckoutSplitPlans, pickPrimaryCheckoutOrderIndex } from './checkout-split'
import type { CheckoutSplitLine } from './checkout-split'

function line(partial: Partial<CheckoutSplitLine> & Pick<CheckoutSplitLine, 'fulfillmentSource' | 'lineSubtotal'>): CheckoutSplitLine {
  return {
    sourcePlatform: null,
    sourceUrl: '',
    isWarehouseItem: false,
    depositRequired: false,
    ...partial,
  }
}

describe('buildCheckoutSplitPlans', () => {
  it('splits mixed carts, ships once on Vietnam, and keeps discount on regular goods', () => {
    const plans = buildCheckoutSplitPlans({
      lines: [
        line({ fulfillmentSource: 'vietnam', lineSubtotal: 200_000 }),
        line({ fulfillmentSource: 'china', lineSubtotal: 800_000, sourcePlatform: '1688' }),
      ],
      totalDiscount: 100_000,
      shippingFee: 30_000,
      shopDepositMode: 'percent',
      shopDepositPercent: 30,
      shopDepositFixed: 0,
    })
    assert.equal(plans.length, 2)
    assert.equal(plans[0].source, 'vietnam')
    assert.equal(plans[1].source, 'china')
    assert.equal(plans[0].shippingFee, 30_000)
    assert.equal(plans[1].shippingFee, 0)
    assert.equal(plans[0].discount + plans[1].discount, 100_000)
    assert.equal(pickPrimaryCheckoutOrderIndex(plans), 0)
  })

  it('does not charge deposit when shop mode is none', () => {
    const plans = buildCheckoutSplitPlans({
      lines: [line({ fulfillmentSource: 'china', lineSubtotal: 500_000, depositRequired: true })],
      totalDiscount: 0,
      shippingFee: 20_000,
      shopDepositMode: 'none',
      shopDepositPercent: 30,
      shopDepositFixed: 0,
    })
    assert.equal(plans[0].requiresDeposit, false)
    assert.equal(plans[0].requiredAmount, 0)
    assert.equal(plans[0].shippingFee, 20_000)
  })

  it('china_no_deposit when SKU deposit flags exist only on Vietnam', () => {
    const plans = buildCheckoutSplitPlans({
      lines: [
        line({ fulfillmentSource: 'vietnam', lineSubtotal: 100_000, depositRequired: true }),
        line({ fulfillmentSource: 'china', lineSubtotal: 400_000, depositRequired: false }),
      ],
      totalDiscount: 0,
      shippingFee: 0,
      shopDepositMode: 'percent',
      shopDepositPercent: 30,
      shopDepositFixed: 0,
    })
    assert.equal(plans[0].requiresDeposit, true)
    assert.equal(plans[1].requiresDeposit, false)
  })

  it('skips deposit on warehouse-only groups', () => {
    const plans = buildCheckoutSplitPlans({
      lines: [line({ fulfillmentSource: 'vietnam', lineSubtotal: 90_000, isWarehouseItem: true })],
      totalDiscount: 0,
      shippingFee: 0,
      shopDepositMode: 'percent',
      shopDepositPercent: 30,
      shopDepositFixed: 0,
    })
    assert.equal(plans[0].requiresDeposit, false)
  })

  it('charges shop fixed_amount once on mixed VN+China cart', () => {
    const plans = buildCheckoutSplitPlans({
      lines: [
        line({ fulfillmentSource: 'vietnam', lineSubtotal: 200_000, depositRequired: true }),
        line({ fulfillmentSource: 'china', lineSubtotal: 800_000, depositRequired: true, sourcePlatform: '1688' }),
      ],
      totalDiscount: 0,
      shippingFee: 30_000,
      shopDepositMode: 'fixed_amount',
      shopDepositPercent: 30,
      shopDepositFixed: 150_000,
    })
    assert.equal(plans[0].requiredAmount, 150_000)
    assert.equal(plans[1].requiredAmount, 0)
    assert.equal(plans[0].requiresDeposit, true)
    assert.equal(plans[1].requiresDeposit, false)
  })
})
