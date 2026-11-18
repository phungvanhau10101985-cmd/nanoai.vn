import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  FLUX_AREA_1_5K,
  FLUX_AREA_2K,
  FLUX_MAX_PIXELS,
  FLUX_MAX_PIXELS_WITH_IMAGES,
  FLUX_MAX_RATIO,
  FLUX_MAX_SIDE,
  FLUX_MIN_SIDE,
  FLUX_STEP,
  closestFluxAspectRatio,
  fitFluxPixels,
  fluxPixelsForPrintMm,
  fluxPrintPixelsFromMm,
} from './flux-image-size'

function assertGrid(size: { width: number; height: number }, cap: number) {
  assert.equal(size.width % FLUX_STEP, 0)
  assert.equal(size.height % FLUX_STEP, 0)
  assert.ok(size.width >= FLUX_MIN_SIDE && size.width <= FLUX_MAX_SIDE)
  assert.ok(size.height >= FLUX_MIN_SIDE && size.height <= FLUX_MAX_SIDE)
  assert.ok(size.width / size.height <= FLUX_MAX_RATIO + 0.02)
  assert.ok(size.height / size.width <= FLUX_MAX_RATIO + 0.02)
  assert.ok(size.width * size.height <= cap)
}

describe('flux print pixels', () => {
  it('rounds a face up to a multiple of 16 after 3 mm bleed at 300 dpi', () => {
    const raw = fluxPrintPixelsFromMm(100, 271)
    assert.equal(raw.width % 16, 0)
    assert.equal(raw.height % 16, 0)
    assert.ok(raw.height / raw.width > 2.5)
  })

  it('lifts a small face to at least 2K and keeps the ratio', () => {
    const size = fluxPixelsForPrintMm(40, 80, { quality: '2K', hasImages: false })
    assertGrid(size, FLUX_MAX_PIXELS)
    assert.ok(size.width * size.height >= FLUX_AREA_2K)
    assert.ok(Math.abs(size.height / size.width - 86 / 46) < 0.08)
  })

  it('lifts a small face only to the 1.5K floor', () => {
    const size = fluxPixelsForPrintMm(40, 80, { quality: '1.5K', hasImages: false })
    assertGrid(size, FLUX_MAX_PIXELS)
    assert.ok(size.width * size.height >= FLUX_AREA_1_5K)
    assert.ok(size.width * size.height < FLUX_AREA_2K)
  })

  it('caps a referenced image at 4 megapixels', () => {
    const size = fitFluxPixels(3000, 4000, { quality: '4K', hasImages: true })
    assertGrid(size, FLUX_MAX_PIXELS_WITH_IMAGES)
  })

  it('maps odd ratios onto a FLUX aspect when width and height are not sent', () => {
    assert.equal(closestFluxAspectRatio('1:1'), '1:1')
    assert.equal(closestFluxAspectRatio('9:16'), '9:16')
    assert.equal(closestFluxAspectRatio('1:4'), '9:21')
  })
})
