import assert from 'node:assert/strict'
import test from 'node:test'
import { createPartnerAiRouteDecision, resolvePartnerAiFinalRouteDecision } from './partner-ai-intent-router'
import {
  extractBareProductSku,
  extractConsultCallbackPhone,
  inheritBareProductSkuFromPriorInbounds,
} from './partner-ai-bare-code-consult'

test('bare product code is a sample sku, not an order or a phone', () => {
  assert.equal(extractBareProductSku('K4627'), 'K4627')
  assert.equal(extractBareProductSku('mã A6009'), 'A6009')
  assert.equal(extractBareProductSku('K4627 còn hàng không'), null)
  assert.equal(extractBareProductSku('DH493'), null)
  assert.equal(extractBareProductSku('0522656868'), null)
  assert.equal(extractBareProductSku('Cần tư vấn 0522656868'), null)
})

test('consult plus phone is a callback, not a product menu or an order lookup', () => {
  assert.equal(extractConsultCallbackPhone('Cần tư vấn 0522656868'), '0522656868')
  assert.equal(extractConsultCallbackPhone('nhờ tư vấn 0912 345 678'), '0912345678')
  assert.equal(extractConsultCallbackPhone('Cần tư vấn áo sơ mi 0522656868'), null)
  assert.equal(extractConsultCallbackPhone('Kiểm tra đơn 0522656868 gửi chưa'), null)
  assert.equal(extractConsultCallbackPhone('K4627'), null)
})

test('phone consult inherits the product code from the previous inbound only', () => {
  assert.equal(
    inheritBareProductSkuFromPriorInbounds(['Cần tư vấn 0522656868', 'K4627']),
    'K4627'
  )
  assert.equal(
    inheritBareProductSkuFromPriorInbounds(['Cần tư vấn 0522656868', 'cho em xem áo', 'K4627']),
    null
  )
})

test('bare sku hard rule beats a clarify classifier and still loses to order lookup', () => {
  const classified = createPartnerAiRouteDecision('clarify', {
    source: 'ai_classifier',
    confidence: 0.9,
    reason: 'bare code',
  })
  const skuRoute = resolvePartnerAiFinalRouteDecision({
    classified,
    orderStatusAsk: false,
    policyAsk: false,
    followUpHeuristic: false,
    explicitProductSku: 'K4627',
  })
  assert.equal(skuRoute.intent, 'explicit_sku_consult')
  assert.equal(skuRoute.source, 'hard_rule')
  assert.equal(skuRoute.reason, 'bare_product_sku')

  const orderRoute = resolvePartnerAiFinalRouteDecision({
    classified,
    orderStatusAsk: true,
    policyAsk: false,
    followUpHeuristic: false,
    explicitProductSku: 'K4627',
  })
  assert.equal(orderRoute.intent, 'policy_or_order_support')
  assert.equal(orderRoute.reason, 'order_status_lookup')
})

test('bare sku does not replace follow-up, purchase, similar, or new search', () => {
  for (const intent of [
    'follow_up_current_product',
    'purchase_or_order',
    'similar_alternatives',
    'new_product_search',
    'pause_or_close',
  ] as const) {
    const classified = createPartnerAiRouteDecision(intent, {
      source: 'ai_classifier',
      confidence: 0.8,
      reason: 'kept',
    })
    const route = resolvePartnerAiFinalRouteDecision({
      classified,
      orderStatusAsk: false,
      policyAsk: false,
      followUpHeuristic: false,
      explicitProductSku: 'K4627',
    })
    assert.equal(route.intent, intent)
    assert.equal(route.reason, 'kept')
  }
})