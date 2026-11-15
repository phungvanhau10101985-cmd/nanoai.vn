import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import fontkit from '@pdf-lib/fontkit'
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHeader,
  PDFName,
  PDFNumber,
  PDFOperator,
  PDFOperatorNames,
  PDFString,
  StandardFonts,
  cmyk,
  endMarkedContent,
  moveTo,
  lineTo,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  restoreDashPattern,
  setDashPattern,
  setGraphicsState,
  setLineWidth,
  setStrokingCmykColor,
  stroke,
} from 'pdf-lib'
import sharp from 'sharp'
import type { TuckEndLayoutData } from '@/lib/packaging/box-net-svg'
import type { DielineWarning } from '@/lib/packaging/dieline-artwork'

const MM = 2.834645669
const MARGIN_MM = 14
const LEGEND_MM = 28

type Seg = [number, number, number, number]

function pt(mm: number): number {
  return mm * MM
}

function separation(doc: PDFDocument, name: string, cmykColor: [number, number, number, number]) {
  const fn = doc.context.obj({
    FunctionType: 2,
    Domain: [0, 1],
    C0: [0, 0, 0, 0],
    C1: cmykColor,
    N: 1,
  })
  const space = PDFArray.withContext(doc.context)
  space.push(PDFName.of('Separation'))
  space.push(PDFName.of(name))
  space.push(PDFName.of('DeviceCMYK'))
  space.push(fn)
  return space
}

function childDict(parent: PDFDict, key: string): PDFDict {
  const found = parent.lookupMaybe(PDFName.of(key), PDFDict)
  if (found) return found
  const created = PDFDict.withContext(parent.context)
  parent.set(PDFName.of(key), created)
  return created
}

function cutBounds(layout: TuckEndLayoutData) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x1, y1, x2, y2] of layout.cutSegments) {
    minX = Math.min(minX, x1, x2)
    minY = Math.min(minY, y1, y2)
    maxX = Math.max(maxX, x1, x2)
    maxY = Math.max(maxY, y1, y2)
  }
  if (!Number.isFinite(minX)) return null
  return { minX, minY, maxX, maxY }
}

async function cmykJpeg(png: Buffer): Promise<Buffer> {
  return sharp(png).toColourspace('cmyk').jpeg({ quality: 90 }).toBuffer()
}

function spotStroke(spaceName: string, segments: Seg[], map: (seg: Seg) => [number, number, number, number], dashed: boolean) {
  const ops = [
    pushGraphicsState(),
    setGraphicsState('Overprint'),
    PDFOperator.of(PDFOperatorNames.StrokingColorspace, [PDFName.of(spaceName)]),
    PDFOperator.of(PDFOperatorNames.StrokingColorN, [PDFNumber.of(1)]),
    setLineWidth(dashed ? 0.6 : 0.7),
    ...(dashed ? [setDashPattern([pt(3), pt(1.4)], 0)] : []),
    PDFOperator.of(PDFOperatorNames.BeginMarkedContentSequence, [PDFName.of('OC'), PDFName.of(spaceName)]),
  ]
  for (const seg of segments) {
    const [x1, y1, x2, y2] = map(seg)
    ops.push(moveTo(x1, y1), lineTo(x2, y2), stroke())
  }
  ops.push(endMarkedContent())
  if (dashed) ops.push(restoreDashPattern())
  ops.push(popGraphicsState())
  return ops
}

export async function createPrintDielinePdf(input: {
  artworkPng?: Buffer
  layout: TuckEndLayoutData
  bleedMm: number
  safeZoneMm: number
  legend: string[]
  warnings: DielineWarning[]
  title: string
}): Promise<Buffer> {
  const { layout, bleedMm, safeZoneMm } = input
  const contentW = layout.bounds.widthMm + bleedMm * 2
  const contentH = layout.bounds.heightMm + bleedMm * 2
  const pageW = pt(MARGIN_MM * 2 + contentW)
  const pageH = pt(MARGIN_MM * 2 + LEGEND_MM + contentH)
  const offsetX = pt(MARGIN_MM)
  const offsetY = pt(MARGIN_MM + LEGEND_MM)

  const pdfDoc = await PDFDocument.create()
  pdfDoc.registerFontkit(fontkit)
  pdfDoc.context.header = PDFHeader.forVersion(1, 6)
  const page = pdfDoc.addPage([pageW, pageH])

  if (input.artworkPng) {
    const jpeg = await cmykJpeg(input.artworkPng)
    const image = await pdfDoc.embedJpg(jpeg)
    page.drawImage(image, {
      x: offsetX,
      y: offsetY,
      width: pt(contentW),
      height: pt(contentH),
    })
  }

  const resources = page.node.Resources() ?? PDFDict.withContext(pdfDoc.context)
  if (!page.node.Resources()) page.node.set(PDFName.of('Resources'), resources)
  const colors = childDict(resources, 'ColorSpace')
  colors.set(PDFName.of('CutContour'), separation(pdfDoc, 'CutContour', [0, 1, 0, 0]))
  colors.set(PDFName.of('Crease'), separation(pdfDoc, 'Crease', [0.6, 0, 1, 0]))
  const states = childDict(resources, 'ExtGState')
  states.set(
    PDFName.of('Overprint'),
    pdfDoc.context.obj({ Type: 'ExtGState', OP: true, op: true, OPM: 1 })
  )
  const cutLayer = pdfDoc.context.obj({ Type: 'OCG', Name: PDFString.of('Cut') })
  const creaseLayer = pdfDoc.context.obj({ Type: 'OCG', Name: PDFString.of('Crease') })
  const safeLayer = pdfDoc.context.obj({
    Type: 'OCG',
    Name: PDFString.of('Safe zone'),
    Usage: { Print: { PrintState: 'OFF' }, View: { ViewState: 'ON' } },
  })
  const cutRef = pdfDoc.context.register(cutLayer)
  const creaseRef = pdfDoc.context.register(creaseLayer)
  const safeRef = pdfDoc.context.register(safeLayer)
  const props = childDict(resources, 'Properties')
  props.set(PDFName.of('CutContour'), cutRef)
  props.set(PDFName.of('Crease'), creaseRef)
  props.set(PDFName.of('SafeZone'), safeRef)
  pdfDoc.catalog.set(
    PDFName.of('OCProperties'),
    pdfDoc.context.obj({
      OCGs: [cutRef, creaseRef, safeRef],
      D: { Name: PDFString.of('Dieline'), Order: [cutRef, creaseRef, safeRef], ON: [cutRef, creaseRef] },
    })
  )
  pdfDoc.catalog.set(
    PDFName.of('OutputIntents'),
    pdfDoc.context.obj([
      {
        Type: 'OutputIntent',
        S: 'GTS_PDFX',
        OutputConditionIdentifier: PDFString.of('FOGRA39'),
        Info: PDFString.of('PDF/X-4'),
        RegistryName: PDFString.of('http://www.color.org'),
      },
    ])
  )

  const toX = (x: number) => offsetX + pt(bleedMm + x)
  const toY = (y: number) => offsetY + pt(layout.bounds.heightMm + bleedMm - y)
  const mapSeg = (seg: Seg): [number, number, number, number] => [toX(seg[0]), toY(seg[1]), toX(seg[2]), toY(seg[3])]

  const bounds = cutBounds(layout)
  if (bounds) {
    const corners = [
      { x: toX(bounds.minX), y: toY(bounds.minY), hx: -1, vy: 1 },
      { x: toX(bounds.maxX), y: toY(bounds.minY), hx: 1, vy: 1 },
      { x: toX(bounds.minX), y: toY(bounds.maxY), hx: -1, vy: -1 },
      { x: toX(bounds.maxX), y: toY(bounds.maxY), hx: 1, vy: -1 },
    ]
    const imageLeft = offsetX
    const imageRight = offsetX + pt(contentW)
    const imageBottom = offsetY
    const imageTop = offsetY + pt(contentH)
    const gap = pt(1)
    const mark = pt(4)
    page.pushOperators(pushGraphicsState(), setStrokingCmykColor(0, 0, 0, 1), setLineWidth(0.4))
    for (const corner of corners) {
      const x0 = corner.hx < 0 ? imageLeft - gap - mark : imageRight + gap
      const x1 = corner.hx < 0 ? imageLeft - gap : imageRight + gap + mark
      const y0 = corner.vy > 0 ? imageTop + gap : imageBottom - gap - mark
      const y1 = corner.vy > 0 ? imageTop + gap + mark : imageBottom - gap
      page.pushOperators(moveTo(x0, corner.y), lineTo(x1, corner.y), stroke(), moveTo(corner.x, y0), lineTo(corner.x, y1), stroke())
    }
    page.pushOperators(popGraphicsState())
  }

  page.pushOperators(...spotStroke('CutContour', layout.cutSegments, mapSeg, false))
  page.pushOperators(...spotStroke('Crease', layout.foldSegments, mapSeg, true))

  page.pushOperators(
    pushGraphicsState(),
    PDFOperator.of(PDFOperatorNames.BeginMarkedContentSequence, [PDFName.of('OC'), PDFName.of('SafeZone')]),
    setStrokingCmykColor(1, 0, 0, 0),
    setLineWidth(0.35),
    setDashPattern([pt(1.2), pt(0.8)], 0)
  )
  for (const panel of layout.panels) {
    const inset = Math.min(safeZoneMm, panel.w / 2 - 0.4, panel.h / 2 - 0.4)
    if (inset < 1) continue
    const x = toX(panel.x + inset)
    const y = toY(panel.y + panel.h - inset)
    page.pushOperators(rectangle(x, y, pt(panel.w - inset * 2), pt(panel.h - inset * 2)), stroke())
  }
  page.pushOperators(endMarkedContent(), restoreDashPattern(), popGraphicsState())

  let font
  try {
    const bytes = readFileSync(join(process.cwd(), 'src/lib/wedding/fonts/BeVietnamPro-Regular.ttf'))
    font = await pdfDoc.embedFont(bytes, { subset: true })
  } catch {
    font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  }
  const lines = [...input.legend, ...input.warnings.map((item) => item.message)].slice(0, 8)
  const ink = cmyk(0, 0, 0, 1)
  lines.forEach((line, index) => {
    const y = pt(4) + (lines.length - 1 - index) * 10
    try {
      page.drawText(line, { x: pt(6), y, size: 8, font, color: ink })
    } catch {
      const plain = line.normalize('NFD').replace(/[^\x20-\x7E]/g, ' ')
      page.drawText(plain, { x: pt(6), y, size: 8, font: font, color: ink })
    }
  })

  pdfDoc.setTitle(input.title)
  pdfDoc.setProducer('NanoAI dieline PDF/X-4')
  pdfDoc.setCreator('NanoAI')
  const saved = Buffer.from(await pdfDoc.save({ useObjectStreams: false }))
  const header = Buffer.from('%PDF-1.6')
  if (saved.subarray(0, 8).toString('latin1') === '%PDF-1.7') header.copy(saved, 0)
  return saved
}
