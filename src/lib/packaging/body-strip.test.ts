import assert from 'node:assert/strict'
import test from 'node:test'
import sharp from 'sharp'
import { getBodyStripSegments, getBodyStripSizeMm } from './body-strip'
import { splitBodyStripBuffer } from './body-strip-server'

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

test('split preserves exact pixel boundaries without gaps', async () => {
  const source = await sharp({
    create: {
      width: 320,
      height: 60,
      channels: 3,
      background: { r: 10, g: 20, b: 30 },
    },
  }).png().toBuffer()
  const split = await splitBodyStripBuffer(source, dimensions)
  const widths = await Promise.all(
    (['front', 'right', 'back', 'left'] as const).map(async (slot) =>
      sharp(split[slot]!).metadata().then((metadata) => metadata.width)
    )
  )
  assert.deepEqual(widths, [120, 40, 120, 40])
  assert.equal(widths.reduce((sum, width) => sum + (width ?? 0), 0), 320)
})
