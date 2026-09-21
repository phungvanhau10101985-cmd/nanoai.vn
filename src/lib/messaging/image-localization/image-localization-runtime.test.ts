import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import sharp from 'sharp'
import { isOwnCdnUrl } from './image-localization-config'
import { visionVerticesToPixelRect } from '@/lib/vision-ocr'
import { overlayTranslatedText } from '@/lib/translate-overlay'
import { isTransientImageLocDbError } from './process-product'
import { imageLocJobIsStalled } from './job-runtime'

const originalPublicBase = process.env.BUNNY_STORAGE_PUBLIC_BASE_URL

afterEach(() => {
  if (originalPublicBase == null) delete process.env.BUNNY_STORAGE_PUBLIC_BASE_URL
  else process.env.BUNNY_STORAGE_PUBLIC_BASE_URL = originalPublicBase
})

describe('image localization runtime parity', () => {
  it('keeps Vision REST pixel coordinates unchanged', () => {
    const rect = visionVerticesToPixelRect(
      [{ x: 12, y: 20 }, { x: 112, y: 20 }, { x: 112, y: 60 }, { x: 12, y: 60 }],
      1200,
      1600
    )
    assert.deepEqual(rect, { x: 12, y: 20, width: 100, height: 40 })
  })

  it('still supports normalized vertices when supplied', () => {
    const rect = visionVerticesToPixelRect(
      [{ x: 0.1, y: 0.2 }, { x: 0.3, y: 0.2 }, { x: 0.3, y: 0.4 }, { x: 0.1, y: 0.4 }],
      1000,
      500
    )
    assert.deepEqual(rect, { x: 100, y: 100, width: 200, height: 100 })
  })

  it('treats only the configured NanoAI Bunny host as own CDN', () => {
    process.env.BUNNY_STORAGE_PUBLIC_BASE_URL = 'https://nanoai.b-cdn.net'
    assert.equal(isOwnCdnUrl('https://nanoai.b-cdn.net/localized-images/a.jpg'), true)
    assert.equal(isOwnCdnUrl('https://188comvn.b-cdn.net/site/a.jpg'), false)
    assert.equal(isOwnCdnUrl('https://img.alicdn.com/a.jpg'), false)
  })

  it('clips local text overlays to the source image', async () => {
    const source = await sharp({
      create: { width: 80, height: 60, channels: 3, background: '#d9d9d9' },
    })
      .png()
      .toBuffer()
    const out = await overlayTranslatedText(
      source,
      [{ bbox: { x: 70, y: 50, width: 100, height: 100 }, translatedText: 'Đã dịch' }],
      { sampleBackground: true }
    )
    const meta = await sharp(out).metadata()
    assert.equal(meta.width, 80)
    assert.equal(meta.height, 60)
  })

  it('erases domains and old years even without replacement text', async () => {
    const source = await sharp({
      create: { width: 24, height: 24, channels: 3, background: '#000000' },
    })
      .png()
      .toBuffer()
    const out = await overlayTranslatedText(
      source,
      [{ bbox: { x: 4, y: 4, width: 12, height: 12 }, translatedText: '', eraseOriginal: true }],
      { fillColor: '#ffffff' }
    )
    const pixel = await sharp(out).extract({ left: 8, top: 8, width: 1, height: 1 }).raw().toBuffer()
    assert.deepEqual([...pixel.subarray(0, 3)], [255, 255, 255])
  })

  it('retries only transient database failures', () => {
    assert.equal(isTransientImageLocDbError({ code: '40001' }), true)
    assert.equal(isTransientImageLocDbError(new Error('read ECONNRESET')), true)
    assert.equal(isTransientImageLocDbError({ code: '23505' }), false)
  })

  it('replaces stalled processing workers but never off-peak waiters', () => {
    const now = Date.parse('2026-09-21T04:00:00.000Z')
    const stale = '2026-09-21T03:30:00.000Z'
    assert.equal(imageLocJobIsStalled({ status: 'running', phase: 'processing', updated_at: stale }, now), true)
    assert.equal(imageLocJobIsStalled({ status: 'running', phase: 'waiting_off_peak', updated_at: stale }, now), false)
    assert.equal(imageLocJobIsStalled({ status: 'done', phase: 'done', updated_at: stale }, now), false)
  })
})
