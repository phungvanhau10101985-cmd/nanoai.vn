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

  it('still charges a product that requires deposit when the shop mode is none', () => {
    const plans = buildCheckoutSplitPlans({
      lines: [line({ fulfillmentSource: 'china', lineSubtotal: 500_000, depositRequired: true })],
      totalDiscount: 0,
      shippingFee: 20_000,
      shopDepositMode: 'none',
      shopDepositPercent: 30,
      shopDepositFixed: 0,
    })
    assert.equal(plans[0].requiresDeposit, true)
    assert.equal(plans[0].depositPercent, 30)
    assert.equal(plans[0].requiredAmount, 150_000)
    assert.equal(plans[0].shippingFee, 20_000)
  })

  it('charges the percent only on lines flagged for deposit', () => {
    const plans = buildCheckoutSplitPlans({
      lines: [
        line({ fulfillmentSource: 'vietnam', lineSubtotal: 1_000_000, depositRequired: true }),
        line({ fulfillmentSource: 'vietnam', lineSubtotal: 1_000_000, depositRequired: false }),
      ],
      totalDiscount: 0,
      shippingFee: 0,
      shopDepositMode: 'percent',
      shopDepositPercent: 10,
      shopDepositFixed: 0,
    })
    assert.equal(plans.length, 1)
    assert.equal(plans[0].depositPayable, 1_000_000)
    assert.equal(plans[0].requiredAmount, 100_000)
    assert.equal(plans[0].depositPercent, 10)
  })

  it('does not charge deposit when the product flag is off', () => {
    const plans = buildCheckoutSplitPlans({
      lines: [line({ fulfillmentSource: 'vietnam', lineSubtotal: 1_181_500, depositRequired: false })],
      totalDiscount: 0,
      shippingFee: 0,
      shopDepositMode: 'percent',
      shopDepositPercent: 10,
      shopDepositFixed: 0,
    })
    assert.equal(plans[0].requiresDeposit, false)
    assert.equal(plans[0].requiredAmount, 0)
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
      lines: [line({ fulfillmentSource: 'vietnam', lineSubtotal: 90_000, isWarehouseItem: true, depositRequired: true })],
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

  it('takes 30 percent deposit from Flash unit price, not list minus Flash twice', () => {
    const plans = buildCheckoutSplitPlans({
      lines: [line({ fulfillmentSource: 'vietnam', lineSubtotal: 9_935_800, depositRequired: true })],
      totalDiscount: 0,
      shippingFee: 0,
      shopDepositMode: 'percent',
      shopDepositPercent: 30,
      shopDepositFixed: 0,
    })
    assert.equal(plans[0].amountAfterDiscount, 9_935_800)
    assert.equal(plans[0].requiredAmount, 2_980_740)
  })

  it('uses the saved 10 percent instead of 30', () => {
    const plans = buildCheckoutSplitPlans({
      lines: [line({ fulfillmentSource: 'vietnam', lineSubtotal: 1_181_500, depositRequired: true })],
      totalDiscount: 0,
      shippingFee: 0,
      shopDepositMode: 'percent',
      shopDepositPercent: 10,
      shopDepositFixed: 0,
    })
    assert.equal(plans[0].depositPercent, 10)
    assert.equal(plans[0].requiredAmount, 118_150)
  })

  it('raises a percent deposit to 100_000 and caps it at the goods total', () => {
    const raised = buildCheckoutSplitPlans({
      lines: [line({ fulfillmentSource: 'vietnam', lineSubtotal: 400_000, depositRequired: true })],
      totalDiscount: 0,
      shippingFee: 0,
      shopDepositMode: 'percent',
      shopDepositPercent: 10,
      shopDepositFixed: 0,
    })
    assert.equal(raised[0].depositPercent, 10)
    assert.equal(raised[0].requiredAmount, 100_000)

    const capped = buildCheckoutSplitPlans({
      lines: [line({ fulfillmentSource: 'vietnam', lineSubtotal: 80_000, depositRequired: true })],
      totalDiscount: 0,
      shippingFee: 0,
      shopDepositMode: 'percent',
      shopDepositPercent: 10,
      shopDepositFixed: 0,
    })
    assert.equal(capped[0].depositPercent, 10)
    assert.equal(capped[0].requiredAmount, 80_000)
  })

  it('requires 30 percent when unit price is 3_000_000 even if the product flag is off', () => {
    const plans = buildCheckoutSplitPlans({
      lines: [line({ fulfillmentSource: 'vietnam', lineSubtotal: 3_000_000, unitPrice: 3_000_000, depositRequired: false })],
      totalDiscount: 0,
      shippingFee: 0,
      shopDepositMode: 'percent',
      shopDepositPercent: 10,
      shopDepositFixed: 0,
    })
    assert.equal(plans[0].requiresDeposit, true)
    assert.equal(plans[0].depositPercent, 30)
    assert.equal(plans[0].requiredAmount, 900_000)
  })

  it('leaves a unit price under 3_000_000 on the product flag', () => {
    const plans = buildCheckoutSplitPlans({
      lines: [line({ fulfillmentSource: 'vietnam', lineSubtotal: 2_999_999, unitPrice: 2_999_999, depositRequired: false })],
      totalDiscount: 0,
      shippingFee: 0,
      shopDepositMode: 'percent',
      shopDepositPercent: 10,
      shopDepositFixed: 0,
    })
    assert.equal(plans[0].requiresDeposit, false)
    assert.equal(plans[0].requiredAmount, 0)
  })

  it('raises a flagged 10 percent line to 30 when the unit price meets the threshold', () => {
    const plans = buildCheckoutSplitPlans({
      lines: [line({ fulfillmentSource: 'vietnam', lineSubtotal: 4_000_000, unitPrice: 4_000_000, depositRequired: true })],
      totalDiscount: 0,
      shippingFee: 0,
      shopDepositMode: 'percent',
      shopDepositPercent: 10,
      shopDepositFixed: 0,
    })
    assert.equal(plans[0].depositPercent, 30)
    assert.equal(plans[0].requiredAmount, 1_200_000)
  })

  it('keeps a shop percent that is already above the floor', () => {
    const plans = buildCheckoutSplitPlans({
      lines: [line({ fulfillmentSource: 'vietnam', lineSubtotal: 4_000_000, unitPrice: 4_000_000, depositRequired: true })],
      totalDiscount: 0,
      shippingFee: 0,
      shopDepositMode: 'percent',
      shopDepositPercent: 50,
      shopDepositFixed: 0,
    })
    assert.equal(plans[0].depositPercent, 50)
    assert.equal(plans[0].requiredAmount, 2_000_000)
  })

  it('does not apply the floor to clearance warehouse lines', () => {
    const plans = buildCheckoutSplitPlans({
      lines: [
        line({
          fulfillmentSource: 'vietnam',
          lineSubtotal: 4_000_000,
          unitPrice: 4_000_000,
          isWarehouseItem: true,
          depositRequired: false,
        }),
      ],
      totalDiscount: 0,
      shippingFee: 0,
      shopDepositMode: 'percent',
      shopDepositPercent: 30,
      shopDepositFixed: 0,
    })
    assert.equal(plans[0].requiresDeposit, false)
    assert.equal(plans[0].requiredAmount, 0)
  })

  it('requires 30 percent when three 1_000_000 products make one order of 3_000_000', () => {
    const plans = buildCheckoutSplitPlans({
      lines: [
        line({ fulfillmentSource: 'vietnam', lineSubtotal: 1_000_000, unitPrice: 1_000_000, depositRequired: false }),
        line({ fulfillmentSource: 'vietnam', lineSubtotal: 1_000_000, unitPrice: 1_000_000, depositRequired: false }),
        line({ fulfillmentSource: 'vietnam', lineSubtotal: 1_000_000, unitPrice: 1_000_000, depositRequired: false }),
      ],
      totalDiscount: 0,
      shippingFee: 0,
      shopDepositMode: 'percent',
      shopDepositPercent: 10,
      shopDepositFixed: 0,
    })
    assert.equal(plans.length, 1)
    assert.equal(plans[0].requiresDeposit, true)
    assert.equal(plans[0].depositPercent, 30)
    assert.equal(plans[0].depositPayable, 3_000_000)
    assert.equal(plans[0].requiredAmount, 900_000)
  })

  it('counts quantity in the line total, so one 1_000_000 product times 3 is also 30 percent', () => {
    const plans = buildCheckoutSplitPlans({
      lines: [line({ fulfillmentSource: 'vietnam', lineSubtotal: 3_000_000, unitPrice: 1_000_000, depositRequired: false })],
      totalDiscount: 0,
      shippingFee: 0,
      shopDepositMode: 'percent',
      shopDepositPercent: 10,
      shopDepositFixed: 0,
    })
    assert.equal(plans[0].depositPercent, 30)
    assert.equal(plans[0].requiredAmount, 900_000)
  })

  it('does not combine two fulfillment orders that each stay under 3_000_000', () => {
    const plans = buildCheckoutSplitPlans({
      lines: [
        line({ fulfillmentSource: 'vietnam', lineSubtotal: 1_500_000, unitPrice: 1_500_000, depositRequired: false }),
        line({ fulfillmentSource: 'china', lineSubtotal: 1_500_000, unitPrice: 1_500_000, depositRequired: false }),
      ],
      totalDiscount: 0,
      shippingFee: 0,
      shopDepositMode: 'percent',
      shopDepositPercent: 10,
      shopDepositFixed: 0,
    })
    assert.equal(plans.length, 2)
    assert.equal(plans[0].requiresDeposit, false)
    assert.equal(plans[1].requiresDeposit, false)
  })

  it('raises a fixed deposit up to 30 percent of an order at the threshold', () => {
    const plans = buildCheckoutSplitPlans({
      lines: [line({ fulfillmentSource: 'vietnam', lineSubtotal: 4_000_000, unitPrice: 4_000_000, depositRequired: false })],
      totalDiscount: 0,
      shippingFee: 0,
      shopDepositMode: 'fixed_amount',
      shopDepositPercent: 10,
      shopDepositFixed: 150_000,
    })
    assert.equal(plans[0].requiredAmount, 1_200_000)
    assert.equal(plans[0].requiresDeposit, true)
  })
})
