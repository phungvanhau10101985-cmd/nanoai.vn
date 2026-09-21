import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { partnerAffiliateCommissionMutation } from './messaging-partner-affiliate-pg'

describe('partner affiliate order lifecycle', () => {
  it('makes grant, confirm and clawback terminal replays no-ops', () => {
    assert.equal(partnerAffiliateCommissionMutation('pending', 'confirmed'), 'confirm_pending')
    assert.equal(partnerAffiliateCommissionMutation('confirmed', 'confirmed'), 'none')
    assert.equal(partnerAffiliateCommissionMutation('pending', 'reversed'), 'reverse_pending')
    assert.equal(partnerAffiliateCommissionMutation('confirmed', 'reversed'), 'reverse_confirmed')
    assert.equal(partnerAffiliateCommissionMutation('cancelled', 'reversed'), 'none')
  })

  it('keeps one commission per partner order and serializes wallet mutations', () => {
    const source = readFileSync(new URL('./messaging-partner-affiliate-pg.ts', import.meta.url), 'utf8')
    const schema = readFileSync(
      new URL('../../../db/migrations/20260904233000_partner_sale_parity_188.sql', import.meta.url),
      'utf8'
    )

    assert.match(source, /on conflict \(partner_id, order_id\) do nothing/)
    assert.match(
      source,
      /where partner_id = \$1::uuid and order_id = \$2::uuid\s+for update/
    )
    assert.match(
      schema,
      /messaging_partner_affiliate_commissions[\s\S]*unique \(partner_id, order_id\)/
    )
  })
})
