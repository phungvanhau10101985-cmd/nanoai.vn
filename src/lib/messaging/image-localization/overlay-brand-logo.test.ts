import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import sharp from 'sharp'
import {
  IMAGE_LOC_BRAND_LOGO_TEMPLATE_MAX_PX,
  imageLocBrandLogoMarginFrac,
  imageLocBrandLogoMaxWidthFrac,
} from './image-localization-config'
import {
  brandLogoStampLayout,
  normalizeBrandLogoTemplate,
  overlayBrandLogoOnProcessedImage,
} from './overlay-brand-logo'

async function solidPng(width: number, height: number, color: { r: number; g: number; b: number; alpha?: number }) {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: color.r, g: color.g, b: color.b, alpha: color.alpha ?? 255 },
    },
  })
    .png()
    .toBuffer()
}

async function pixelAt(buf: Buffer, x: number, y: number) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const i = (y * info.width + x) * info.channels
  return [data[i], data[i + 1], data[i + 2], data[i + 3]] as const
}

describe('image localization brand logo stamp (188)', () => {
  it('uses 188 max-width and margin defaults', () => {
    assert.equal(imageLocBrandLogoMaxWidthFrac(), 0.22)
    assert.equal(imageLocBrandLogoMarginFrac(), 0.012)
  })

  it('scales a large logo to 22% of image width at the top-right corner', () => {
    const layout = brandLogoStampLayout(800, 800, 1200, 400)
    assert.ok(layout)
    assert.equal(layout.width, Math.trunc(800 * 0.22))
    assert.equal(layout.height, Math.trunc(400 * (layout.width / 1200)))
    const margin = Math.max(4, Math.trunc(800 * 0.012))
    assert.equal(layout.left, 800 - layout.width - margin)
    assert.equal(layout.top, margin)
  })

  it('does not skip overlay when original logo is wider than the product image', () => {
    const layout = brandLogoStampLayout(200, 200, 1200, 400)
    assert.ok(layout)
    assert.equal(layout.width, Math.max(8, Math.trunc(200 * 0.22)))
    assert.ok(layout.left >= 0)
    assert.ok(layout.left + layout.width <= 200)
  })

  it('does not enlarge a small logo', () => {
    const layout = brandLogoStampLayout(800, 800, 40, 20)
    assert.ok(layout)
    assert.equal(layout.width, 40)
    assert.equal(layout.height, 20)
  })

  it('normalizes uploaded logo to a PNG no larger than the template max', async () => {
    const huge = await solidPng(1600, 900, { r: 10, g: 20, b: 30 })
    const out = await normalizeBrandLogoTemplate(huge)
    const meta = await sharp(out).metadata()
    assert.equal(meta.format, 'png')
    assert.ok((meta.width || 0) <= IMAGE_LOC_BRAND_LOGO_TEMPLATE_MAX_PX)
    assert.ok((meta.height || 0) <= IMAGE_LOC_BRAND_LOGO_TEMPLATE_MAX_PX)
    assert.equal(meta.hasAlpha, true)
  })

  it('stamps a large logo onto a smaller processed image at the top-right', async () => {
    const image = await solidPng(200, 200, { r: 255, g: 0, b: 0 })
    const logo = await solidPng(1200, 400, { r: 0, g: 255, b: 0 })
    const out = await overlayBrandLogoOnProcessedImage(image, logo)
    const layout = brandLogoStampLayout(200, 200, 1200, 400)
    assert.ok(layout)
    const onLogo = await pixelAt(out, layout.left + 2, layout.top + 2)
    const offLogo = await pixelAt(out, 20, 100)
    assert.ok(onLogo[1] > 200 && onLogo[0] < 40, `expected green stamp, got ${onLogo.join(',')}`)
    assert.ok(offLogo[0] > 200 && offLogo[1] < 40, `expected red canvas, got ${offLogo.join(',')}`)
  })

  it('leaves the image unchanged when there is no logo', async () => {
    const image = await solidPng(80, 80, { r: 12, g: 34, b: 56 })
    const out = await overlayBrandLogoOnProcessedImage(image, null)
    assert.equal(out, image)
  })
})
