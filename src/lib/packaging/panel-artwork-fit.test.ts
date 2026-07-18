import assert from 'node:assert/strict'
import test from 'node:test'
import sharp from 'sharp'
import {
  extendPanelArtworkBleed,
  fitPanelArtworkToTrim,
  mmToPrintPx,
  preparePanelArtworkForDieline,
} from './panel-artwork-fit'

test('mmToPrintPx uses 300dpi rounding', () => {
  assert.equal(mmToPrintPx(25.4), 300)
  assert.equal(mmToPrintPx(10), Math.round((10 * 300) / 25.4))
})

test('fitPanelArtworkToTrim outputs exact trim pixels with fill', async () => {
  const source = await sharp({
    create: { width: 400, height: 200, channels: 3, background: { r: 200, g: 50, b: 50 } },
  })
    .png()
    .toBuffer()
  const widthMm = 120
  const heightMm = 60
  const trimmed = await fitPanelArtworkToTrim(source, widthMm, heightMm)
  const metadata = await sharp(trimmed).metadata()
  assert.equal(metadata.width, mmToPrintPx(widthMm))
  assert.equal(metadata.height, mmToPrintPx(heightMm))
})

test('extendPanelArtworkBleed adds bleed pixels on all sides', async () => {
  const trim = await sharp({
    create: { width: 100, height: 50, channels: 3, background: { r: 10, g: 20, b: 30 } },
  })
    .png()
    .toBuffer()
  const bleedMm = 3
  const extended = await extendPanelArtworkBleed(trim, bleedMm)
  const metadata = await sharp(extended).metadata()
  const bleedPx = mmToPrintPx(bleedMm)
  assert.equal(metadata.width, 100 + bleedPx * 2)
  assert.equal(metadata.height, 50 + bleedPx * 2)
})

test('preparePanelArtworkForDieline returns trim and bleed buffers', async () => {
  const source = await sharp({
    create: { width: 200, height: 100, channels: 3, background: { r: 255, g: 0, b: 0 } },
  })
    .png()
    .toBuffer()
  const prepared = await preparePanelArtworkForDieline(source, 120, 40, 3)
  assert.equal(prepared.trimWidthPx, mmToPrintPx(120))
  assert.equal(prepared.trimHeightPx, mmToPrintPx(40))
  assert.equal(prepared.bleedWidthPx, prepared.trimWidthPx + mmToPrintPx(3) * 2)
  assert.equal(prepared.bleedHeightPx, prepared.trimHeightPx + mmToPrintPx(3) * 2)
  const trimMeta = await sharp(prepared.trimBuffer).metadata()
  const bleedMeta = await sharp(prepared.bleedBuffer).metadata()
  assert.equal(trimMeta.width, prepared.trimWidthPx)
  assert.equal(bleedMeta.width, prepared.bleedWidthPx)
})
