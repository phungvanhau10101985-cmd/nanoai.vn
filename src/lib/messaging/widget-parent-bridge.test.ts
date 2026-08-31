import assert from 'node:assert/strict'
import test from 'node:test'
import {
  NANOAI_WIDGET_MSG_SOURCE,
  isSetPageContextMessage,
  parseWidgetPageContextFromChatUrl,
} from '@/lib/messaging/widget-parent-bridge'

test('parseWidgetPageContextFromChatUrl reads try-on image like 188 embed', () => {
  const ctx = parseWidgetPageContextFromChatUrl(
    '/messaging/p/demo?embed=1&open_try_on=1&ctx_image=https%3A%2F%2Fcdn.shop%2Fbag.jpg&ctx_sku=BAG-1&ctx_inventory=bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  )
  assert.equal(ctx.imageUrl, 'https://cdn.shop/bag.jpg')
  assert.equal(ctx.sku, 'BAG-1')
  assert.equal(ctx.inventoryId, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
  assert.equal(ctx.openTryOn, true)
})

test('parseWidgetPageContextFromChatUrl ignores empty query', () => {
  const ctx = parseWidgetPageContextFromChatUrl('/messaging/p/demo?embed=1')
  assert.deepEqual(ctx, {})
})

test('isSetPageContextMessage accepts parent SET_PAGE_CONTEXT', () => {
  assert.equal(
    isSetPageContextMessage({
      source: NANOAI_WIDGET_MSG_SOURCE,
      type: 'SET_PAGE_CONTEXT',
      imageUrl: 'https://cdn.shop/bag.jpg',
      openTryOn: true,
    }),
    true
  )
  assert.equal(isSetPageContextMessage({ type: 'SET_PAGE_CONTEXT' }), false)
})
