import assert from 'node:assert/strict'
import test from 'node:test'
import sharp from 'sharp'
import { BOX_DIELINE_STRUCTURE_KEYS, boxDielineStructureSlug, resolveBoxDielineStructure } from './dieline-structure'
import { getBoxDielineLayoutData } from './box-net-svg'
import { layoutFoldOrientationOk } from './dieline-orientation'
import { composeDielineRaster } from './dieline-artwork'
import { createBoxDielinePdf } from './box-dieline-pdf'
import { buildBlankDielineSvg } from './dieline-blank-files'
import type { BoxFaceSlot } from './box-face-slots'

const dimensions = { lengthMm: 120, widthMm: 80, heightMm: 50 }
const production = {
  bleedMm: 3,
  glueTabMm: 15,
  paperThicknessMm: 0.5,
  compensationGapMm: 1,
  paperStock: 'ivory_350' as const,
  fingerNotch: true,
  lockDetails: true,
  safeZoneMm: 4,
  insertCols: 2,
  insertRows: 3,
  jarDiameterMm: 0,
}

function overlapCount(layout: ReturnType<typeof getBoxDielineLayoutData>) {
  const key = (line: number[]) => line.map((n) => n.toFixed(3)).join(',')
  const cuts = new Set(layout.cutSegments.map(key))
  return layout.foldSegments.filter((line) => cuts.has(key(line))).length
}

test('old straight-tuck files are reverse tuck, and the new key is same-side', () => {
  assert.equal(boxDielineStructureSlug('reverse_tuck'), 'reverse-tuck')
  assert.equal(boxDielineStructureSlug('straight_tuck'), 'straight-tuck')
  assert.equal(resolveBoxDielineStructure('straight_tuck', 1), 'reverse_tuck')
  assert.equal(resolveBoxDielineStructure(undefined, undefined), 'reverse_tuck')
  assert.equal(resolveBoxDielineStructure('cross_fold', 1), 'cross_fold')
  assert.equal(resolveBoxDielineStructure('straight_tuck', 2), 'straight_tuck')
  const straight = getBoxDielineLayoutData('straight_tuck', dimensions, production)
  const reverse = getBoxDielineLayoutData('reverse_tuck', dimensions, production)
  const at = (layout: typeof straight, slot: BoxFaceSlot) => layout.panels.find((panel) => panel.slot === slot)!
  assert.equal(at(straight, 'bottom').x, at(straight, 'front').x)
  assert.equal(at(reverse, 'bottom').x, at(reverse, 'back').x)
  assert.notEqual(at(straight, 'bottom').x, at(reverse, 'bottom').x)
})

test('every carton style has cuts, a positive sheet and fold-aligned art', () => {
  for (const structure of BOX_DIELINE_STRUCTURE_KEYS) {
    const layout = getBoxDielineLayoutData(structure, dimensions, production)
    assert.ok(layout.cutSegments.length > 0, structure)
    assert.ok(layout.bounds.widthMm > 0 && layout.bounds.heightMm > 0, structure)
    assert.equal(overlapCount(layout), 0, structure)
    assert.equal(layoutFoldOrientationOk(structure, layout), true, structure)
  }
  const cross = getBoxDielineLayoutData('cross_fold', dimensions, production)
  assert.equal(cross.panels.find((panel) => panel.slot === 'back')?.rotation, 180)
})

test('artwork extends 3 mm past the outer cut and glue stays white', async () => {
  const red = await sharp({
    create: { width: 40, height: 40, channels: 3, background: { r: 220, g: 0, b: 0 } },
  })
    .png()
    .toBuffer()
  const slots = Object.fromEntries(
    (['top', 'front', 'right', 'bottom', 'back', 'left'] as BoxFaceSlot[]).map((slot) => [slot, red])
  ) as Partial<Record<BoxFaceSlot, Buffer>>
  const layout = getBoxDielineLayoutData('reverse_tuck', dimensions, { ...production, fingerNotch: false })
  const dpi = 96
  const { png } = await composeDielineRaster({
    layout,
    slotBuffers: slots,
    boxLengthMm: dimensions.lengthMm,
    boxWidthMm: dimensions.widthMm,
    boxHeightMm: dimensions.heightMm,
    bleedMm: 3,
    dpi,
    safeZoneMm: 4,
  })
  const px = (mm: number) => Math.round((mm * dpi) / 25.4)
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const at = (x: number, y: number) => {
    const i = (y * info.width + x) * 3
    return [data[i], data[i + 1], data[i + 2]]
  }
  const front = layout.panels.find((panel) => panel.slot === 'front')!
  const outside = at(px(3 + front.x - 2), px(3 + front.y + front.h / 2))
  assert.ok(outside[0]! > 180 && outside[1]! < 40, `bleed pixel ${outside.join(',')}`)
  const glue = layout.glueRects![0]!
  const gluePx = at(px(3 + glue.x + glue.w / 2), px(3 + glue.y + glue.h / 2))
  assert.ok(gluePx[0]! > 240 && gluePx[1]! > 240, `glue pixel ${gluePx.join(',')}`)
})

test('finger notch warns on an edge bar and stays quiet on a solid face', async () => {
  const quiet = await sharp({
    create: { width: 80, height: 80, channels: 3, background: { r: 40, g: 90, b: 160 } },
  })
    .png()
    .toBuffer()
  const noisy = await sharp({
    create: { width: 320, height: 180, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .composite([
      {
        input: await sharp({
          create: { width: 320, height: 28, channels: 3, background: { r: 0, g: 0, b: 0 } },
        })
          .png()
          .toBuffer(),
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toBuffer()
  const layout = getBoxDielineLayoutData('reverse_tuck', dimensions, production)
  const base = {
    layout,
    boxLengthMm: dimensions.lengthMm,
    boxWidthMm: dimensions.widthMm,
    boxHeightMm: dimensions.heightMm,
    bleedMm: 3,
    dpi: 72,
    safeZoneMm: 4,
  }
  const solid = await composeDielineRaster({
    ...base,
    slotBuffers: { top: quiet, front: quiet, right: quiet, bottom: quiet, back: quiet, left: quiet },
  })
  assert.equal(solid.warnings.some((item) => item.code.startsWith('finger-notch')), false)
  const hit = await composeDielineRaster({
    ...base,
    slotBuffers: { top: quiet, front: quiet, right: quiet, bottom: quiet, back: noisy, left: quiet },
  })
  assert.ok(hit.warnings.some((item) => item.code === 'finger-notch:back'))
})

test('print pdf carries spot colors, CMYK and PDF/X, and the blank svg is cut and crease only', async () => {
  const red = await sharp({
    create: { width: 20, height: 20, channels: 3, background: { r: 180, g: 20, b: 20 } },
  })
    .png()
    .toBuffer()
  const pdf = await createBoxDielinePdf({
    boxLength: 80,
    boxWidth: 50,
    boxHeight: 40,
    structure: 'reverse_tuck',
    production,
    slotBuffers: { front: red, top: red },
  })
  const text = pdf.pdfBuffer.toString('latin1')
  assert.match(text, /CutContour/)
  assert.match(text, /Crease/)
  assert.match(text, /DeviceCMYK/)
  assert.match(text, /GTS_PDFX/)
  const blank = buildBlankDielineSvg(getBoxDielineLayoutData('reverse_tuck', dimensions, production))
  assert.match(blank, /id="CutContour"/)
  assert.match(blank, /id="Crease"/)
  assert.match(blank, /stroke-dasharray/)
  assert.doesNotMatch(blank, /<image/)
})
