import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { deliveredEffectKeys } from './order-delivered-hook'
import {
  partnerOrderDeliveryEffectClaimSql,
  partnerOrderDeliveryEffectFinishSql,
} from '@/lib/db/messaging-partner-order-delivery-effects-pg'

describe('delivered hook effect plan', () => {
  it('uses one stable effect set for linked EMS/customer/admin orders', () => {
    assert.deepEqual(deliveredEffectKeys({ conversation_id: 'conversation-id' }), [
      'customer_notification',
      'review_invitation',
      'first_order_promotion',
      'affiliate_confirmation',
    ])
  })

  it('omits conversation-dependent promotion but keeps other effects', () => {
    assert.deepEqual(deliveredEffectKeys({ conversation_id: null }), [
      'customer_notification',
      'review_invitation',
      'affiliate_confirmation',
    ])
  })

  it('uses lease tokens so a stale delivery worker cannot finish a reclaimed effect', () => {
    const claimSql = partnerOrderDeliveryEffectClaimSql()
    const finishSql = partnerOrderDeliveryEffectFinishSql()
    assert.match(claimSql, /claim_token = excluded\.claim_token/)
    assert.match(claimSql, /claimed_at < now\(\) - interval '15 minutes'/)
    assert.match(finishSql, /claim_token = \$3::uuid/)
    assert.match(finishSql, /status = 'running'/)
  })
})
