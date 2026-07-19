import assert from 'node:assert/strict'
import test from 'node:test'
import sharp from 'sharp'
import { createBoxDielinePdf } from '@/lib/packaging/box-dieline-pdf'

async function solid(width: number, height: number, rgb: { r: number; g: number; b: number }) {
  return sharp({ create: { width, height, channels: 3, background: rgb } }).png().toBuffer()
}

test('PDF export supports continuous body source and legacy six slots', async () => {
  const top = await solid(120, 40, { r: 240, g: 240, b: 240 })
  const side = await solid(120, 60, { r: 50, g: 100, b: 150 })
  const strip = await solid(320, 60, { r: 20, g: 140, b: 80 })
  const common = { boxLength: 120, boxWidth: 40, boxHeight: 60 }

  const legacy = await createBoxDielinePdf({
    ...common,
    slotBuffers: {
      top,
      bottom: top,
      front: side,
      right: side,
      back: side,
      left: side,
    },
  })
  const hybrid = await createBoxDielinePdf({
    ...common,
    slotBuffers: { top, bottom: top },
    bodyStripBuffer: strip,
    production: {
      bleedMm: 3,
      glueTabMm: 18,
      paperThicknessMm: 0.4,
      compensationGapMm: 0.5,
    },
  })
  assert.equal(legacy.pdfBuffer.subarray(0, 4).toString(), '%PDF')
  assert.equal(hybrid.pdfBuffer.subarray(0, 4).toString(), '%PDF')
  assert.notDeepEqual(hybrid.pdfBuffer, legacy.pdfBuffer)
})

test('PDF export supports the cross-fold hand-assembly structure', async () => {
  const top = await solid(120, 40, { r: 240, g: 240, b: 240 })
  const side = await solid(120, 60, { r: 50, g: 100, b: 150 })
  const pdf = await createBoxDielinePdf({
    boxLength: 120,
    boxWidth: 40,
    boxHeight: 60,
    structure: 'cross_fold',
    slotBuffers: {
      top,
      bottom: top,
      front: side,
      right: side,
      back: side,
      left: side,
    },
  })
  assert.equal(pdf.pdfBuffer.subarray(0, 4).toString(), '%PDF')
})
