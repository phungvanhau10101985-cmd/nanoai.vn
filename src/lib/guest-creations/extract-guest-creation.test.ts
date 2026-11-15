import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { extractGuestCreation, guestCreationHasPayload } from './extract-guest-creation'

const NOW = 1_700_000_000_000
const FRESH = NOW - 5_000
const OLD = NOW - 86_400_000

describe('extractGuestCreation', () => {
  it('keeps fresh output urls and record ids, drops older library urls', () => {
    const text = JSON.stringify({
      imageUrl: `https://cdn.nanoai.vn/results/abc/studio_logo_${FRESH}.png`,
      library: `https://cdn.nanoai.vn/results/abc/studio_logo_${OLD}.png`,
      threadId: '11111111-1111-4111-8111-111111111111',
      audioUrl: `https://cdn.nanoai.vn/music-history/abc/lyria3_${FRESH}.mp3`,
      jobId: '22222222-2222-4222-8222-222222222222',
    })
    const extracted = extractGuestCreation(text, { now: NOW, route: '/tao-banner' })
    assert.deepEqual(extracted.resultUrls, [
      `https://cdn.nanoai.vn/results/abc/studio_logo_${FRESH}.png`,
      `https://cdn.nanoai.vn/music-history/abc/lyria3_${FRESH}.mp3`,
    ])
    assert.equal(extracted.refs.threadId, '11111111-1111-4111-8111-111111111111')
    assert.equal(extracted.refs.jobId, undefined)
    assert.equal(guestCreationHasPayload(extracted), true)
  })

  it('reads escaped urls and a worksheet job id on the curriculum route', () => {
    const text = `{"imageUrl":"https:\\/\\/cdn.nanoai.vn\\/uploads\\/u\\/translate_${FRESH}.png","jobId":"33333333-3333-4333-8333-333333333333"}`
    const extracted = extractGuestCreation(text, { now: NOW, route: '/tao-giao-trinh' })
    assert.deepEqual(extracted.resultUrls, [`https://cdn.nanoai.vn/uploads/u/translate_${FRESH}.png`])
    assert.equal(extracted.refs.jobId, '33333333-3333-4333-8333-333333333333')
  })

  it('ignores a response with no fresh file and no id', () => {
    const extracted = extractGuestCreation('{"ok":true}', { now: NOW })
    assert.equal(guestCreationHasPayload(extracted), false)
  })
})
