import assert from 'node:assert/strict'
import test from 'node:test'
import { inflateSync } from 'node:zlib'
import sharp from 'sharp'
import { BOX_DIELINE_STRUCTURE_KEYS, boxDielineStructureSlug, resolveBoxDielineStructure } from './dieline-structure'
import { getBoxDielineLayoutData } from './box-net-svg'
import { dielineDisplayBounds } from './dieline-sheet-bounds'
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

function pointSegDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len2 = dx * dx + dy * dy
  if (len2 < 1e-9) return Math.hypot(px - x1, py - y1)
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

function looseFoldEnds(layout: ReturnType<typeof getBoxDielineLayoutData>) {
  const loose: string[] = []
  layout.foldSegments.forEach((fold, index) => {
    const ends: Array<[number, number]> = [
      [fold[0], fold[1]],
      [fold[2], fold[3]],
    ]
    for (const [px, py] of ends) {
      const onCut = layout.cutSegments.some((seg) => pointSegDist(px, py, seg[0], seg[1], seg[2], seg[3]) < 0.45)
      const onFold = layout.foldSegments.some(
        (seg, other) => other !== index && pointSegDist(px, py, seg[0], seg[1], seg[2], seg[3]) < 0.45
      )
      if (!onCut && !onFold) loose.push(`${px},${py}`)
    }
  })
  return loose
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
    assert.deepEqual(looseFoldEnds(layout), [], structure)
    assert.equal(layoutFoldOrientationOk(structure, layout), true, structure)
  }
  const cross = getBoxDielineLayoutData('cross_fold', dimensions, production)
  assert.equal(cross.panels.find((panel) => panel.slot === 'back')?.rotation, 180)
  const straight = getBoxDielineLayoutData('straight_tuck', dimensions, production)
  assert.equal(straight.panels.find((panel) => panel.slot === 'top')?.rotation, 0)
  assert.equal(straight.panels.find((panel) => panel.slot === 'bottom')?.rotation, 180)
})

test('recheck geometry closes the styles that still failed', () => {
  const eye = { lengthMm: 35, widthMm: 35, heightMm: 95 }
  const sheet = (structure: (typeof BOX_DIELINE_STRUCTURE_KEYS)[number]) => {
    const layout = getBoxDielineLayoutData(structure, eye, production)
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const seg of layout.cutSegments) {
      minX = Math.min(minX, seg[0], seg[2])
      minY = Math.min(minY, seg[1], seg[3])
      maxX = Math.max(maxX, seg[0], seg[2])
      maxY = Math.max(maxY, seg[1], seg[3])
    }
    assert.ok(Math.abs(minX) < 0.05 && Math.abs(minY) < 0.05, structure)
    assert.ok(Math.abs(layout.bounds.widthMm - (maxX - minX)) < 0.05, structure)
    assert.ok(Math.abs(layout.bounds.heightMm - (maxY - minY)) < 0.05, structure)
    return layout
  }
  const hex = sheet('hexagon')
  const tongue = hex.foldSegments.filter((seg) => Math.abs(seg[1] - seg[3]) < 0.2 && seg[1] < 20)
  assert.ok(tongue.length >= 1, 'hexagon lid needs a tongue crease')
  const pillow = sheet('pillow')
  const span = Math.max(...pillow.foldSegments.map((seg) => Math.abs(seg[2] - seg[0])))
  assert.ok(span > 90, `pillow center crease ${span}`)
  assert.ok(pillow.bounds.widthMm > 120, 'pillow axis is the long side plus both end curves')
  assert.ok(pillow.bounds.heightMm > 140, 'pillow girth wraps the 35×35 section')
  assert.deepEqual(looseFoldEnds(pillow), [])
  const tube = sheet('tube')
  assert.equal(tube.panels.filter((panel) => panel.slot === 'front').length, 1)
  assert.ok(tube.panels.some((panel) => panel.slot === 'right'))
  assert.ok(tube.panels.some((panel) => panel.slot === 'back'))
  const telescope = sheet('telescope')
  assert.ok(telescope.panels.filter((panel) => panel.slot === 'front').length >= 2)
  const magnetic = sheet('magnetic')
  assert.ok(magnetic.cutSegments.length > 20)
  const sleeve = sheet('sleeve_tray')
  assert.match(sleeve.legendLines?.join(' ') ?? '', /bằng sản phẩm/)
  const divider = sheet('insert')
  assert.doesNotMatch(divider.legendLines?.join(' ') ?? '', /Bleed/)
  const handle = sheet('handle')
  assert.ok(handle.knockouts?.some((item) => item.kind === 'handle' && item.w >= 25 && item.h >= 15))
  const bottle = getBoxDielineLayoutData('bottle', eye, { ...production, neckDiameterMm: 18 })
  assert.ok((bottle.knockouts?.filter((item) => item.kind === 'neck').length ?? 0) >= 2)
  const crash = sheet('crash_lock')
  assert.match(crash.legendLines?.join(' ') ?? '', /móc/)
  const snap = sheet('snap_lock')
  assert.match(snap.legendLines?.join(' ') ?? '', /1-2-3/)
  assert.match(snap.legendLines?.join(' ') ?? '', /khía chữ U/)
  const sleeveShown = dielineDisplayBounds(sleeve)
  assert.ok(Math.abs(sleeveShown.heightMm - sleeve.bounds.heightMm) < 0.25, `sleeve sheet ${sleeveShown.heightMm} vs ${sleeve.bounds.heightMm}`)
  assert.ok(Math.abs(sleeveShown.widthMm - sleeve.bounds.widthMm) < 0.25)
  const eyeCross = getBoxDielineLayoutData('cross_fold', eye, production)
  const lid = eyeCross.panels.find((panel) => panel.slot === 'top')!
  for (const glue of eyeCross.glueRects ?? []) {
    const onTongue = glue.y + glue.h <= lid.y + 0.4 && glue.x < lid.x + lid.w && glue.x + glue.w > lid.x
    const onLidEar =
      glue.y < lid.y + lid.h - 0.4 &&
      glue.y + glue.h > lid.y + 0.4 &&
      (glue.x + glue.w <= lid.x + 0.6 || glue.x >= lid.x + lid.w - 0.6)
    assert.equal(onTongue || onLidEar, false)
  }
  const openBottle = getBoxDielineLayoutData('bottle', eye, production)
  assert.match(openBottle.legendLines?.join(' ') ?? '', /chữ П/)
  assert.equal((openBottle.knockouts ?? []).filter((item) => item.kind === 'neck').length, 0)
  const windowed = getBoxDielineLayoutData('window', eye, production)
  const film = windowed.overlays?.find((item) => item.kind === 'window-film')
  const host = windowed.panels.filter((panel) => panel.slot === 'right').sort((a, b) => b.h - a.h)[0]
  assert.ok(film && host)
  assert.ok(film!.x >= host!.x + 1.8 && film!.x + film!.w <= host!.x + host!.w - 1.8)
  const oneJar = getBoxDielineLayoutData('insert', eye, production)
  assert.match(oneJar.legendLines?.join(' ') ?? '', /34×34/)
  assert.ok(oneJar.bounds.widthMm <= 35, `insert sheet ${oneJar.bounds.widthMm}`)
  assert.deepEqual(looseFoldEnds(oneJar), [])
})

test('artwork extends 3 mm past the outer cut and glue stays white', async () => {
  const red = await sharp({
    create: { width: 240, height: 100, channels: 3, background: { r: 220, g: 0, b: 0 } },
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

test('a flat gray bar at the top of a face is left unprinted', async () => {
  const face = await sharp({
    create: { width: 240, height: 100, channels: 3, background: { r: 20, g: 90, b: 160 } },
  })
    .composite([
      {
        input: await sharp({
          create: { width: 240, height: 22, channels: 3, background: { r: 190, g: 190, b: 190 } },
        })
          .png()
          .toBuffer(),
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toBuffer()
  const layout = getBoxDielineLayoutData('straight_tuck', dimensions, { ...production, fingerNotch: false })
  const { png } = await composeDielineRaster({
    layout,
    slotBuffers: { back: face },
    boxLengthMm: dimensions.lengthMm,
    boxWidthMm: dimensions.widthMm,
    boxHeightMm: dimensions.heightMm,
    bleedMm: 3,
    dpi: 72,
    safeZoneMm: 4,
  })
  const back = layout.panels.find((panel) => panel.slot === 'back')!
  const px = (mm: number) => Math.round((mm * 72) / 25.4)
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const x = px(3 + back.x + back.w / 2)
  const y = px(3 + back.y + 2)
  const i = (y * info.width + x) * 3
  assert.ok(data[i]! > 240 && data[i + 1]! > 240 && data[i + 2]! > 240, `gray bar pixel ${data[i]},${data[i + 1]},${data[i + 2]}`)
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
  assert.match(text, /TrimBox/)
  assert.match(text, /BleedBox/)
  assert.match(text, /DestOutputProfile/)
  assert.match(text, /NANOAI\+/)
  assert.match(text, /CreateDate/)
  assert.ok(pdf.pdfBuffer.includes(Buffer.from('Nắp', 'utf8')), 'XMP title stays UTF-8')
  const streams = text.match(/stream\r?\n([\s\S]*?)endstream/g) ?? []
  const decoded = streams
    .map((block) => {
      const body = block.replace(/^stream\r?\n/, '').replace(/endstream$/, '')
      try {
        return inflateSync(Buffer.from(body, 'latin1')).toString('latin1')
      } catch {
        return body
      }
    })
    .join('\n')
  assert.match(decoded, /\nh\b/, 'closed cut paths')
  assert.match(decoded, /(^|\s)c(\s|$)/m, 'round cuts use Bezier curves')
  const blank = buildBlankDielineSvg(getBoxDielineLayoutData('reverse_tuck', dimensions, production))
  assert.match(blank, /id="CutContour"/)
  assert.match(blank, /id="Crease"/)
  assert.match(blank, /stroke-dasharray/)
  assert.doesNotMatch(blank, /<image/)
})
