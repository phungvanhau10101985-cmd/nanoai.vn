import assert from 'node:assert/strict'
import test from 'node:test'
import { capiCustomDataPayload, sendMetaConversionsApiBatch } from './meta-view-content'

test('CAPI payload missing content_name does not throw', async () => {
  const payload = capiCustomDataPayload({
    content_ids: ['sku-1'],
    content_name: undefined as unknown as string,
    content_type: 'product',
    currency: 'VND',
    value: 10,
  })
  assert.equal(payload.content_name, 'Product')
  assert.deepEqual(payload.content_ids, ['sku-1'])

  const original = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({ events_received: 1 }), { status: 200 })
  try {
    const result = await sendMetaConversionsApiBatch({
      pixelId: '1234567890',
      accessToken: 'token',
      eventSourceUrl: undefined as unknown as string,
      clientIp: null,
      userAgent: null,
      events: [
        {
          event_name: 'ViewContent',
          event_id: 'e1',
          custom_data: {
            content_ids: ['sku-1'],
            content_name: undefined as unknown as string,
            content_type: 'product',
            currency: 'VND',
            value: 10,
          },
        },
      ],
    })
    assert.equal(result.ok, true)
  } finally {
    globalThis.fetch = original
  }
})
