import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildTikTokEventTrackBody } from '@/lib/tracking/tiktok-events-api'

describe('tiktok events api body', () => {
  it('maps a purchase to CompletePayment with the catalog content id', () => {
    const body = buildTikTokEventTrackBody({
      pixelId: 'CPIXEL123456',
      accessToken: 'secret',
      event: 'CompletePayment',
      eventId: 'Purchase_pay-1',
      eventTimeSec: 1_700_000_000,
      eventSourceUrl: 'https://nanoai.vn/tao-thiep-moi-cuoi-ai/khach-moi',
      contentId: 'feature_tao_thiep_moi_cuoi_ai',
      contentName: 'Tạo thiệp cưới AI',
      valueVnd: 149000,
      orderId: 'pay-1',
      emailSha256: 'a'.repeat(64),
    })
    assert.equal(body.event_source, 'web')
    assert.equal(body.event_source_id, 'CPIXEL123456')
    const row = (body.data as Array<Record<string, unknown>>)[0]
    assert.equal(row.event, 'CompletePayment')
    assert.equal(row.event_id, 'Purchase_pay-1')
    const properties = row.properties as { value: number; contents: Array<{ content_id: string }> }
    assert.equal(properties.value, 149000)
    assert.equal(properties.contents[0].content_id, 'feature_tao_thiep_moi_cuoi_ai')
    assert.equal((row.user as { email: string }).email, 'a'.repeat(64))
  })
})
