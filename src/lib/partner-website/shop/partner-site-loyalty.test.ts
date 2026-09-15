import assert from 'node:assert/strict'
import test from 'node:test'
import type {
  PartnerCustomerLoyaltyStatus,
  PartnerLoyaltyTierRow,
} from '@/lib/db/messaging-partner-loyalty-pg'
import {
  buildPartnerSiteLoyaltyView,
  fillLoyaltyCopy,
  formatLoyaltyMoney,
  formatLoyaltyPercent,
  loyaltyProgressPercent,
  loyaltyRankHint,
  loyaltyWindowLabel,
  normalizePartnerSiteLoyaltyTab,
} from '@/lib/partner-website/shop/partner-site-loyalty'

function tier(partial: Partial<PartnerLoyaltyTierRow> & Pick<PartnerLoyaltyTierRow, 'tier_code'>): PartnerLoyaltyTierRow {
  return {
    id: partial.id ?? partial.tier_code,
    partner_id: 'p1',
    tier_code: partial.tier_code,
    tier_name: partial.tier_name ?? partial.tier_code,
    min_spend_6_months: partial.min_spend_6_months ?? 0,
    discount_percent: partial.discount_percent ?? 0,
    sort_order: partial.sort_order ?? 0,
    is_active: partial.is_active !== false,
    created_at: '',
    updated_at: '',
  }
}

const TIERS = [
  tier({ tier_code: 'L1', min_spend_6_months: 0, discount_percent: 0, sort_order: 0 }),
  tier({ tier_code: 'L2', min_spend_6_months: 4_000_000, discount_percent: 2, sort_order: 1 }),
  tier({ tier_code: 'L3', min_spend_6_months: 8_000_000, discount_percent: 4, sort_order: 2 }),
]

function status(partial: Partial<PartnerCustomerLoyaltyStatus>): PartnerCustomerLoyaltyStatus {
  return {
    enabled: true,
    spendWindowDays: 180,
    totalSpent: 0,
    tier: TIERS[0],
    nextTier: TIERS[1],
    amountToNextTier: 4_000_000,
    maxTotalDiscountPercent: 15,
    ...partial,
  }
}

test('progress is from current floor to next, not from zero', () => {
  assert.equal(loyaltyProgressPercent({ totalSpent: 2_000_000, currentMin: 0, nextMin: 4_000_000 }), 50)
  assert.equal(loyaltyProgressPercent({ totalSpent: 6_000_000, currentMin: 4_000_000, nextMin: 8_000_000 }), 50)
  assert.equal(loyaltyProgressPercent({ totalSpent: 12_000_000, currentMin: 8_000_000, nextMin: null }), 100)
})

test('loyalty view marks current / reached / locked and hides spend when disabled', () => {
  const enabled = buildPartnerSiteLoyaltyView({
    status: status({
      totalSpent: 5_000_000,
      tier: TIERS[1],
      nextTier: TIERS[2],
      amountToNextTier: 3_000_000,
    }),
    tiers: TIERS,
  })
  assert.equal(enabled.current?.code, 'L2')
  assert.equal(enabled.tiers[0].status, 'reached')
  assert.equal(enabled.tiers[1].status, 'current')
  assert.equal(enabled.tiers[2].status, 'locked')
  assert.equal(enabled.progressPercent, 25)
  assert.equal(enabled.amountToNextTier, 3_000_000)

  const paused = buildPartnerSiteLoyaltyView({
    status: status({ enabled: false, totalSpent: 9_000_000, tier: TIERS[2] }),
    tiers: TIERS,
  })
  assert.equal(paused.enabled, false)
  assert.equal(paused.totalSpent, 0)
  assert.equal(paused.current, null)
  assert.ok(paused.tiers.every((t) => t.status === 'locked'))
})

test('copy helpers', () => {
  assert.equal(formatLoyaltyMoney(0), '0đ')
  assert.equal(formatLoyaltyMoney(4_000_000), '4.000.000đ')
  assert.equal(formatLoyaltyPercent(2), '2')
  assert.equal(formatLoyaltyPercent(2.5), '2.5')
  assert.equal(fillLoyaltyCopy('Giảm {percent}% với {name}', { percent: 4, name: 'L3' }), 'Giảm 4% với L3')
  assert.equal(normalizePartnerSiteLoyaltyTab('thanh-vien'), 'loyalty')
  assert.equal(normalizePartnerSiteLoyaltyTab('membership'), 'loyalty')
  assert.equal(normalizePartnerSiteLoyaltyTab('wallet'), null)
  assert.equal(
    loyaltyRankHint(
      {
        loyaltyRank0: 'Member',
        loyaltyRank1: 'Silver',
        loyaltyRank2: 'Gold',
        loyaltyRank3: 'Platinum',
        loyaltyRank4: 'Diamond',
      },
      2
    ),
    'Gold'
  )
  assert.equal(
    loyaltyWindowLabel({ loyaltySpendWindowMonths: '{n} months', loyaltySpendWindowDays: '{n} days' }, 180),
    '6 months'
  )
})