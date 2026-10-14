import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clampNormRect,
  coversFullImage,
  DEFAULT_CROP_RECT,
  hitCropHandle,
  normRectFromDrag,
  pixelCrop,
  resizeNormRect,
} from '@/lib/image-region-crop'

test('default crop stays inside the photo and is not the whole frame', () => {
  const rect = clampNormRect(DEFAULT_CROP_RECT)
  assert.equal(rect.x >= 0 && rect.y >= 0, true)
  assert.equal(rect.x + rect.w <= 1 && rect.y + rect.h <= 1, true)
  assert.equal(coversFullImage(rect), false)
})

test('resize keeps the opposite edge and never leaves the photo', () => {
  const start = { x: 0.2, y: 0.2, w: 0.4, h: 0.4 }
  const west = resizeNormRect(start, 'w', -0.5, 0)
  assert.equal(west.x, 0)
  assert.ok(Math.abs(west.x + west.w - 0.6) < 1e-9)

  const moved = resizeNormRect(start, 'move', 0.9, 0.9)
  assert.equal(moved.w, 0.4)
  assert.equal(moved.h, 0.4)
  assert.equal(moved.x + moved.w <= 1, true)
  assert.equal(moved.y + moved.h <= 1, true)
})

test('a drag becomes the box between the two points', () => {
  const rect = normRectFromDrag(0.7, 0.8, 0.2, 0.3)
  assert.equal(rect.x, 0.2)
  assert.equal(rect.y, 0.3)
  assert.ok(Math.abs(rect.w - 0.5) < 1e-9)
  assert.ok(Math.abs(rect.h - 0.5) < 1e-9)
})

test('corners win over edges, and the inside of the box moves it', () => {
  const rect = { x: 0.2, y: 0.2, w: 0.4, h: 0.4 }
  assert.equal(hitCropHandle(rect, 0.2, 0.2, 0.04), 'nw')
  assert.equal(hitCropHandle(rect, 0.2, 0.4, 0.04), 'w')
  assert.equal(hitCropHandle(rect, 0.4, 0.4, 0.04), 'move')
  assert.equal(hitCropHandle(rect, 0.05, 0.05, 0.04), null)
})

test('pixel crop stays inside the bitmap', () => {
  const box = pixelCrop({ x: 0.9, y: 0.9, w: 0.5, h: 0.5 }, 100, 80)
  assert.equal(box.sx + box.sw <= 100, true)
  assert.equal(box.sy + box.sh <= 80, true)
  assert.equal(box.sw >= 1 && box.sh >= 1, true)
})
