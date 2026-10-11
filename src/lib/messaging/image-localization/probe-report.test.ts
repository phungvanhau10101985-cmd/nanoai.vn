import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  filenameFromProbeImageUrl,
  normalizeProbeImageUrl,
  probeDaysLeft,
  probeExpiresAt,
  probeModelLabel,
  IMAGE_LOC_PROBE_TTL_MS,
} from './probe-report'

describe('image localization probe report', () => {
  it('expires a probe one week after it is created', () => {
    const from = new Date('2026-10-11T06:00:00.000Z')
    const expires = probeExpiresAt(from)
    assert.equal(expires.getTime() - from.getTime(), IMAGE_LOC_PROBE_TTL_MS)
    assert.equal(probeDaysLeft(expires, from), 7)
    assert.equal(probeDaysLeft(expires, new Date(expires.getTime() - 60_000)), 1)
    assert.equal(probeDaysLeft(expires, new Date(expires.getTime() + 60_000)), 0)
  })

  it('accepts an http image link and rejects other text', () => {
    assert.equal(normalizeProbeImageUrl('https://cdn.example/a.jpg'), 'https://cdn.example/a.jpg')
    assert.equal(normalizeProbeImageUrl('//img.alicdn.com/x.webp'), 'https://img.alicdn.com/x.webp')
    assert.equal(normalizeProbeImageUrl('not a link'), null)
    assert.equal(normalizeProbeImageUrl('javascript:alert(1)'), null)
    assert.equal(filenameFromProbeImageUrl('https://cdn.example/path/photo.PNG?x=1'), 'photo.PNG')
    assert.equal(filenameFromProbeImageUrl('https://cdn.example/noext'), 'image.jpg')
  })

  it('names the local translator and GPT Image separately', () => {
    assert.match(probeModelLabel('local'), /^DeepSeek .+ · Vision OCR$/)
    assert.match(probeModelLabel('ai'), /^GPT Image .+ · quality medium · hậu kiểm .+ \+ Vision$/)
    assert.equal(probeModelLabel('keep'), 'Vision OCR')
    assert.equal(probeModelLabel('delete'), 'Vision OCR')
  })
})
