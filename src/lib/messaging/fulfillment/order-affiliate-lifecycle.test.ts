import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { partnerAffiliateCommissionMutation } from '@/lib/db/messaging-partner-affiliate-pg'

describe('affiliate order lifecycle replay safety', () => {
  it('mutates each pending/confirm/clawback edge once', () => {
    assert.equal(partnerAffiliateCommissionMutation('pending', 'confirmed'), 'confirm_pending')
    assert.equal(partnerAffiliateCommissionMutation('confirmed', 'confirmed'), 'none')
    assert.equal(partnerAffiliateCommissionMutation('pending', 'reversed'), 'reverse_pending')
    assert.equal(partnerAffiliateCommissionMutation('confirmed', 'reversed'), 'reverse_confirmed')
    assert.equal(partnerAffiliateCommissionMutation('cancelled', 'reversed'), 'none')
    assert.equal(partnerAffiliateCommissionMutation('reversed', 'reversed'), 'none')
  })

  it('keeps one commission row per partner order at the database boundary', () => {
    const migration = readFileSync(
      new URL('../../../../db/migrations/20260904233000_partner_sale_parity_188.sql', import.meta.url),
      'utf8'
    )
    assert.match(migration, /unique\s*\(\s*partner_id\s*,\s*order_id\s*\)/i)
  })
})
