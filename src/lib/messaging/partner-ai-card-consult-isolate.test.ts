import assert from 'node:assert/strict'
import test from 'node:test'
import { partnerAiShouldIsolateProductCardConsult } from './partner-ai-intent-router'

test('stale product_card_consult does not isolate when intent is new_product_search', () => {
  assert.equal(
    partnerAiShouldIsolateProductCardConsult({
      rawIsProductCardConsult: true,
      routeIntent: 'new_product_search',
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
