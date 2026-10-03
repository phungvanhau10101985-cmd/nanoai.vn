import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createPartnerAiRouteDecision,
  partnerAiIntentAllowsProductContext,
  partnerAiShouldIsolateProductCardConsult,
  resolvePartnerAiFinalRouteDecision,
} from './partner-ai-intent-router'

test('stale product_card_consult does not isolate when intent is new_product_search', () => {
  assert.equal(
    partnerAiShouldIsolateProductCardConsult({
      rawIsProductCardConsult: true,
      routeIntent: 'new_product_search',
    }),
    false
  )
})

test('policy / similar / purchase yield isolation even after Tư vấn click', () => {
  assert.equal(
    partnerAiShouldIsolateProductCardConsult({
      rawIsProductCardConsult: true,
      routeIntent: 'policy_or_order_support',
    }),
    false
  )
  assert.equal(
    partnerAiShouldIsolateProductCardConsult({
      rawIsProductCardConsult: true,
      routeIntent: 'similar_alternatives',
    }),
    false
  )
  assert.equal(
    partnerAiShouldIsolateProductCardConsult({
      rawIsProductCardConsult: true,
      routeIntent: 'purchase_or_order',
    }),
    false
  )
})

test('real Tư vấn click still isolates when intent is not new search', () => {
  assert.equal(
    partnerAiShouldIsolateProductCardConsult({
      rawIsProductCardConsult: true,
      routeIntent: 'follow_up_current_product',
    }),
    true
  )
  assert.equal(
    partnerAiShouldIsolateProductCardConsult({
      rawIsProductCardConsult: true,
      routeIntent: null,
    }),
    true
  )
})

test('no card consult payload never isolates', () => {
  assert.equal(
    partnerAiShouldIsolateProductCardConsult({
      rawIsProductCardConsult: false,
      routeIntent: 'new_product_search',
    }),
    false
  )
})

test('policy, clarify and close never load product context', () => {
  assert.equal(partnerAiIntentAllowsProductContext('policy_or_order_support'), false)
  assert.equal(partnerAiIntentAllowsProductContext('clarify'), false)
  assert.equal(partnerAiIntentAllowsProductContext('pause_or_close'), false)
  assert.equal(partnerAiIntentAllowsProductContext('follow_up_current_product'), true)
  assert.equal(partnerAiIntentAllowsProductContext('similar_alternatives'), true)
})

test('policy hard rule beats product page context classifier before context selection', () => {
  const classified = createPartnerAiRouteDecision('follow_up_current_product', {
    source: 'ai_classifier',
    confidence: 0.92,
  })
  const finalRoute = resolvePartnerAiFinalRouteDecision({
    classified,
    orderStatusAsk: false,
    policyAsk: true,
    followUpHeuristic: true,
  })
  assert.equal(finalRoute.intent, 'policy_or_order_support')
  assert.equal(finalRoute.source, 'hard_rule')
  assert.equal(partnerAiIntentAllowsProductContext(finalRoute.intent), false)
})

test('classifier outage safely clarifies instead of guessing a product', () => {
  const finalRoute = resolvePartnerAiFinalRouteDecision({
    classified: null,
    orderStatusAsk: false,
    policyAsk: false,
    followUpHeuristic: false,
  })
  assert.equal(finalRoute.intent, 'clarify')
  assert.equal(partnerAiIntentAllowsProductContext(finalRoute.intent), false)
})
