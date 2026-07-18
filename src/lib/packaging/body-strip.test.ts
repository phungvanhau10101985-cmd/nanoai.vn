import assert from 'node:assert/strict'
import test from 'node:test'
import sharp from 'sharp'
import { getBodyStripSegments, getBodyStripSizeMm } from './body-strip'
import { splitBodyStripBuffer } from './body-strip-server'
import { mmToPrintPx } from './panel-artwork-fit'

const dimensions = { length: 120, width: 40, height: 60 }

test('non-square body strip follows front|right|back|left offsets', () => {
  assert.deepEqual(getBodyStripSizeMm(dimensions), { widthMm: 320, heightMm: 60 })
  assert.deepEqual(
    getBodyStripSegments(dimensions).map(({ slot, offsetMm, widthMm }) => ({
      slot,
      offsetMm,
      widthMm,
    })),
    [
      { slot: 'front', offsetMm: 0, widthMm: 120 },
      { slot: 'right', offsetMm: 120, widthMm: 40 },
      { slot: 'back', offsetMm: 160, widthMm: 120 },
      { slot: 'left', offsetMm: 280, widthMm: 40 },
    ]
  )
})

test('split preserves exact pixel boundaries without gaps after print normalization', async () => {
  const source = await sharp({
    create: {
      width: 640,
      height: 120,
      channels: 3,
      background: { r: 10, g: 20, b: 30 },
    },
  }).png().toBuffer()
  const split = await splitBodyStripBuffer(source, dimensions)
  const segments = getBodyStripSegments(dimensions)
  const totalPx = mmToPrintPx(getBodyStripSizeMm(dimensions).widthMm)
  const widths = await Promise.all(
    segments.map(({ slot }) => sharp(split[slot]!).metadata().then((metadata) => metadata.width))
  )
  assert.equal(widths.reduce((sum, width) => sum + (width ?? 0), 0), totalPx)
  for (const [index, segment] of segments.entries()) {
    const expected = Math.round((segment.widthMm / 320) * totalPx)
    assert.ok(Math.abs((widths[index] ?? 0) - expected) <= 1, `slot ${segment.slot}`)
  }
})
