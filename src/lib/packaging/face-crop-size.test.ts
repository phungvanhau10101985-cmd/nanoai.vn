import assert from 'node:assert/strict'
import test from 'node:test'

import { cropRegionToPrintSizeMm, formatMmSize, normalizeFaceSizeMm } from '@/lib/packaging/face-crop-size'

test('cropRegionToPrintSizeMm maps pixel crop to mm on face', () => {
  const face = { widthMm: 400, heightMm: 225 }
  const half = cropRegionToPrintSizeMm(face, 1600, 900, { x: 400, y: 225, width: 800, height: 450 })
  assert.equal(half.widthMm, 200)
  assert.equal(half.heightMm, 112.5)
})

test('cropRegionToPrintSizeMm maps contain crop to full face mm', () => {
  const face = { widthMm: 400, heightMm: 100 }
  const full = cropRegionToPrintSizeMm(face, 1000, 800, { x: -1100, y: 0, width: 3200, height: 800 })
  assert.equal(full.widthMm, 400)
  assert.equal(full.heightMm, 100)
})

test('formatMmSize vi uses mm and cm', () => {
  assert.match(formatMmSize('vi', 400, 225), /400.*225.*mm/)
})

test('normalizeFaceSizeMm accepts width/height and widthMm/heightMm', () => {
  assert.deepEqual(normalizeFaceSizeMm({ width: 200, height: 150 }), { widthMm: 200, heightMm: 150 })
  assert.deepEqual(normalizeFaceSizeMm({ widthMm: 200, heightMm: 150 }), { widthMm: 200, heightMm: 150 })
  assert.equal(normalizeFaceSizeMm({ width: 0, height: 150 }), null)
  assert.equal(normalizeFaceSizeMm(null), null)
})
