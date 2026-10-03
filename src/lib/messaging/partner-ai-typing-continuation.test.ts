import assert from 'node:assert/strict'
import test from 'node:test'
import {
  partnerAiPayloadContinuationWaitMs,
  partnerAiPayloadHasPendingOutbound,
  withPartnerAiReplyContinuation,
} from './partner-ai-typing-continuation'

test('split reply continuation keeps the shop typing indicator visible', () => {
  const payload = withPartnerAiReplyContinuation({ source: 'ai_llm' })
  assert.equal(partnerAiPayloadHasPendingOutbound(payload), true)
})

test('pending generated material image also keeps typing visible', () => {
  assert.equal(
    partnerAiPayloadHasPendingOutbound({
      partner_ai_followup_pending: {
        kind: 'material',
        inventory_id: '04671253-cc4d-47a2-8e12-d0964e19e7f8',
      },
    }),
    true
  )
})

test('continuation exposes the expected wait before the next outbound', () => {
  const payload = withPartnerAiReplyContinuation({ source: 'ai_llm' }, 80_000)
  assert.equal(partnerAiPayloadHasPendingOutbound(payload), true)
  assert.equal(partnerAiPayloadContinuationWaitMs(payload), 80_000)
})

test('final outbound without a continuation clears typing', () => {
  assert.equal(partnerAiPayloadHasPendingOutbound({ source: 'ai_llm' }), false)
  assert.equal(
    partnerAiPayloadHasPendingOutbound({
      partner_ai_image_followup: {
        kind: 'material',
        inventory_id: '04671253-cc4d-47a2-8e12-d0964e19e7f8',
      },
    }),
    false
  )
})
