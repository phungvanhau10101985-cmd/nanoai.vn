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
  closePath,
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

type Pt = { x: number; y: number }

function chainPaths(segments: Seg[]): Pt[][] {
  const nodes = segments.map((seg) => ({
    a: { x: seg[0], y: seg[1] },
    b: { x: seg[2], y: seg[3] },
    used: false,
  }))
  const key = (pt: Pt) => `${pt.x.toFixed(2)},${pt.y.toFixed(2)}`
  const at = new Map<string, number[]>()
  nodes.forEach((node, index) => {
    for (const pt of [node.a, node.b]) {
      const list = at.get(key(pt)) ?? []
      list.push(index)
      at.set(key(pt), list)
    }
  })
  const paths: Pt[][] = []
  const extend = (pts: Pt[], atEnd: boolean) => {
    let grew = true
    while (grew) {
      grew = false
      const joint = atEnd ? pts[pts.length - 1]! : pts[0]!
      for (const index of at.get(key(joint)) ?? []) {
        const node = nodes[index]
        if (!node || node.used) continue
        node.used = true
        const other = key(node.a) === key(joint) ? node.b : node.a
        if (atEnd) pts.push(other)
        else pts.unshift(other)
        grew = true
        break
      }
    }
  }
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]
    if (!node || node.used) continue
    node.used = true
    const pts = [node.a, node.b]
    extend(pts, true)
    extend(pts, false)
    paths.push(pts)
  }
  return paths
}

function circleFrom3(a: Pt, b: Pt, c: Pt) {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y))
  if (Math.abs(d) < 1e-6) return null
  const a2 = a.x * a.x + a.y * a.y
  const b2 = b.x * b.x + b.y * b.y
  const c2 = c.x * c.x + c.y * c.y
  const cx = (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d
  const cy = (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d
  return { cx, cy, r: Math.hypot(a.x - cx, a.y - cy) }
}

function arcCubic(cx: number, cy: number, radius: number, a0: number, a1: number): [Pt, Pt, Pt] {
  const delta = a1 - a0
  const k = (4 / 3) * Math.tan(delta / 4)
  const p0 = { x: cx + radius * Math.cos(a0), y: cy + radius * Math.sin(a0) }
  const p3 = { x: cx + radius * Math.cos(a1), y: cy + radius * Math.sin(a1) }
  return [
    { x: p0.x + k * radius * -Math.sin(a0), y: p0.y + k * radius * Math.cos(a0) },
    { x: p3.x - k * radius * -Math.sin(a1), y: p3.y - k * radius * Math.cos(a1) },
    p3,
  ]
}

function fitArc(pts: Pt[], start: number): { end: number; cubics: Array<[Pt, Pt, Pt]> } | null {
  let best: { end: number; cx: number; cy: number; r: number } | null = null
  const limit = Math.min(pts.length - 1, start + 64)
  for (let end = start + 4; end <= limit; end += 1) {
    const prev = pts[end - 1]!
    const point = pts[end]!
    if (Math.hypot(point.x - prev.x, point.y - prev.y) > 4.2) break
    const circle = circleFrom3(pts[start]!, pts[start + Math.floor((end - start) / 2)]!, point)
    if (!circle || circle.r < 1.2 || circle.r > 80) break
    let ok = true
    for (let index = start; index <= end; index += 1) {
      const sample = pts[index]!
      if (Math.abs(Math.hypot(sample.x - circle.cx, sample.y - circle.cy) - circle.r) > 0.06) {
        ok = false
        break
      }
      if (index > start) {
        const left = pts[index - 1]!
        const midX = (left.x + sample.x) / 2
        const midY = (left.y + sample.y) / 2
        if (Math.abs(Math.hypot(midX - circle.cx, midY - circle.cy) - circle.r) > 0.06) {
          ok = false
          break
        }
      }
    }
    if (!ok) break
    best = { end, cx: circle.cx, cy: circle.cy, r: circle.r }
  }
  if (!best) return null
  const slice = pts.slice(start, best.end + 1)
  let sweep = 0
  let prev = Math.atan2(slice[0]!.y - best.cy, slice[0]!.x - best.cx)
  for (let index = 1; index < slice.length; index += 1) {
    const ang = Math.atan2(slice[index]!.y - best.cy, slice[index]!.x - best.cx)
    let delta = ang - prev
    while (delta > Math.PI) delta -= Math.PI * 2
    while (delta < -Math.PI) delta += Math.PI * 2
    sweep += delta
    prev = ang
  }
  if (Math.abs(sweep) < 0.45) return null
  const cubics: Array<[Pt, Pt, Pt]> = []
  let left = sweep
  let ang = Math.atan2(slice[0]!.y - best.cy, slice[0]!.x - best.cx)
  while (Math.abs(left) > 1e-4) {
    const step = Math.sign(left) * Math.min(Math.abs(left), Math.PI / 2)
    cubics.push(arcCubic(best.cx, best.cy, best.r, ang, ang + step))
    ang += step
    left -= step
  }
  return { end: best.end, cubics }
}

function traceOutline(segments: Seg[]): Array<{ pts: Pt[]; closed: boolean }> {
  const key = (pt: Pt) => `${pt.x.toFixed(2)},${pt.y.toFixed(2)}`
  const same = (a: Pt, b: Pt) => key(a) === key(b)
  const edges = segments
    .map((seg) => ({ a: { x: seg[0], y: seg[1] }, b: { x: seg[2], y: seg[3] } }))
    .filter((edge) => Math.hypot(edge.a.x - edge.b.x, edge.a.y - edge.b.y) > 0.02)
  const adj = new Map<string, Array<{ ei: number; to: Pt; ang: number }>>()
  const link = (from: Pt, to: Pt, ei: number) => {
    const list = adj.get(key(from)) ?? []
    list.push({ ei, to, ang: Math.atan2(to.y - from.y, to.x - from.x) })
    adj.set(key(from), list)
  }
  edges.forEach((edge, ei) => {
    link(edge.a, edge.b, ei)
    link(edge.b, edge.a, ei)
  })
  for (const list of adj.values()) list.sort((a, b) => a.ang - b.ang || a.ei - b.ei)
  const used = new Set<string>()
  const dirKey = (ei: number, from: Pt) => `${ei}:${key(from)}`
  const other = (ei: number, from: Pt) => (same(edges[ei]!.a, from) ? edges[ei]!.b : edges[ei]!.a)
  const paths: Array<{ pts: Pt[]; closed: boolean }> = []
  for (let ei = 0; ei < edges.length; ei += 1) {
    for (const startFrom of [edges[ei]!.a, edges[ei]!.b]) {
      if (used.has(dirKey(ei, startFrom))) continue
      const pts: Pt[] = [startFrom]
      const walked: Array<{ ei: number; from: Pt }> = []
      let from = startFrom
      let edgeIndex = ei
      let to = other(edgeIndex, from)
      used.add(dirKey(edgeIndex, from))
      walked.push({ ei: edgeIndex, from })
      pts.push(to)
      let closed = false
      let guard = 0
      while (guard < edges.length * 4 + 8) {
        guard += 1
        if (same(to, pts[0]!) && pts.length > 2) {
          closed = true
          break
        }
        const list = adj.get(key(to)) ?? []
        const backIndex = list.findIndex((item) => item.ei === edgeIndex && same(item.to, from))
        if (backIndex < 0) break
        let picked: (typeof list)[number] | null = null
        for (let step = 1; step <= list.length; step += 1) {
          const candidate = list[(backIndex + step) % list.length]!
          if (!used.has(dirKey(candidate.ei, to))) {
            picked = candidate
            break
          }
        }
        if (!picked) break
        used.add(dirKey(picked.ei, to))
        walked.push({ ei: picked.ei, from: to })
        from = to
        edgeIndex = picked.ei
        to = picked.to
        pts.push(to)
      }
      for (const step of walked) used.add(dirKey(step.ei, other(step.ei, step.from)))
      if (pts.length > 1) paths.push({ pts, closed })
    }
  }
  return paths
}

function spotStroke(
  spaceName: string,
  segments: Seg[],
  map: (seg: Seg) => [number, number, number, number],
  dashed: boolean,
  closeOutline = false
) {
  const mapped = closeOutline ? [] : segments.map((seg) => map(seg))
  const paths = closeOutline ? traceOutline(segments) : chainPaths(mapped).map((pts) => ({ pts, closed: false }))
  const ops = [
    pushGraphicsState(),
    setGraphicsState('Overprint'),
    PDFOperator.of(PDFOperatorNames.StrokingColorspace, [PDFName.of(spaceName)]),
    PDFOperator.of(PDFOperatorNames.StrokingColorN, [PDFNumber.of(1)]),
    setLineWidth(dashed ? 0.6 : 0.7),
    ...(dashed ? [setDashPattern([pt(3), pt(1.4)], 0)] : []),
    PDFOperator.of(PDFOperatorNames.BeginMarkedContentSequence, [PDFName.of('OC'), PDFName.of(spaceName)]),
  ]
  for (const path of paths) {
    const source = path.pts
    if (source.length < 2) continue
    const project = (point: Pt): Pt => {
      if (!closeOutline) return point
      const [x, y] = map([point.x, point.y, point.x, point.y])
      return { x, y }
    }
    const first = project(source[0]!)
    const last = project(source[source.length - 1]!)
    const closed = closeOutline ? path.closed : Math.hypot(first.x - last.x, first.y - last.y) < 0.4
    ops.push(moveTo(first.x, first.y))
    if (closeOutline) {
      let cursor = 0
      while (cursor < source.length - 1) {
        const arc = fitArc(source, cursor)
        if (arc) {
          for (const cubic of arc.cubics) {
            const p1 = project(cubic[0])
            const p2 = project(cubic[1])
            const p3 = project(cubic[2])
            ops.push(
              PDFOperator.of(PDFOperatorNames.AppendBezierCurve, [
                PDFNumber.of(p1.x),
                PDFNumber.of(p1.y),
                PDFNumber.of(p2.x),
                PDFNumber.of(p2.y),
                PDFNumber.of(p3.x),
                PDFNumber.of(p3.y),
              ])
            )
          }
          cursor = arc.end
        } else {
          cursor += 1
          const next = project(source[cursor]!)
          ops.push(lineTo(next.x, next.y))
        }
      }
    } else {
      const draw = closed ? source.slice(0, -1) : source
      for (let index = 1; index < draw.length; index += 1) {
        const next = project(draw[index]!)
        ops.push(lineTo(next.x, next.y))
      }
    }
    if (closed) ops.push(closePath())
    ops.push(stroke())
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
  colors.set(PDFName.of('Glue'), separation(pdfDoc, 'Glue', [0, 0.2, 1, 0]))
  colors.set(PDFName.of('WindowFilm'), separation(pdfDoc, 'WindowFilm', [0.7, 0, 0, 0]))
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
  const glueLayer = pdfDoc.context.obj({ Type: 'OCG', Name: PDFString.of('Glue') })
  const filmLayer = pdfDoc.context.obj({ Type: 'OCG', Name: PDFString.of('Window film') })
  const dimLayer = pdfDoc.context.obj({
    Type: 'OCG',
    Name: PDFString.of('Dimensions'),
    Usage: { Print: { PrintState: 'OFF' }, View: { ViewState: 'ON' } },
  })
  const cutRef = pdfDoc.context.register(cutLayer)
  const creaseRef = pdfDoc.context.register(creaseLayer)
  const safeRef = pdfDoc.context.register(safeLayer)
  const glueRef = pdfDoc.context.register(glueLayer)
  const filmRef = pdfDoc.context.register(filmLayer)
  const dimRef = pdfDoc.context.register(dimLayer)
  const props = childDict(resources, 'Properties')
  props.set(PDFName.of('CutContour'), cutRef)
  props.set(PDFName.of('Crease'), creaseRef)
  props.set(PDFName.of('SafeZone'), safeRef)
  props.set(PDFName.of('Glue'), glueRef)
  props.set(PDFName.of('WindowFilm'), filmRef)
  props.set(PDFName.of('Dimensions'), dimRef)
  pdfDoc.catalog.set(
    PDFName.of('OCProperties'),
    pdfDoc.context.obj({
      OCGs: [cutRef, creaseRef, glueRef, filmRef, safeRef, dimRef],
      D: {
        Name: PDFString.of('Dieline'),
        Order: [cutRef, creaseRef, glueRef, filmRef, safeRef, dimRef],
        ON: [cutRef, creaseRef, glueRef, filmRef, dimRef],
      },
    })
  )
  const profileRef = pdfDoc.context.register(
    pdfDoc.context.stream(readFileSync(join(process.cwd(), 'src/lib/packaging/icc/ISOcoated_v2_eci.icc')), {
      N: 4,
      Alternate: 'DeviceCMYK',
    })
  )
  const outputIntent = pdfDoc.context.obj({
    Type: 'OutputIntent',
    S: 'GTS_PDFX',
    OutputConditionIdentifier: PDFString.of('FOGRA39'),
    OutputCondition: PDFString.of('FOGRA39'),
    Info: PDFString.of('ISO Coated v2 (ECI)'),
    RegistryName: PDFString.of('http://www.color.org'),
    DestOutputProfile: profileRef,
  })
  pdfDoc.catalog.set(PDFName.of('OutputIntents'), pdfDoc.context.obj([outputIntent]))

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

  const trimX = offsetX + pt(bleedMm)
  const trimY = offsetY + pt(bleedMm)
  const trimW = pt(layout.bounds.widthMm)
  const trimH = pt(layout.bounds.heightMm)
  const bleed = pt(bleedMm)
  page.setMediaBox(0, 0, pageW, pageH)
  page.setTrimBox(trimX, trimY, trimW, trimH)
  page.setBleedBox(trimX - bleed, trimY - bleed, trimW + bleed * 2, trimH + bleed * 2)

  page.pushOperators(...spotStroke('CutContour', layout.cutSegments, mapSeg, false, true))
  page.pushOperators(...spotStroke('Crease', layout.foldSegments, mapSeg, true))
  const rectSegs = (rects: Array<{ x: number; y: number; w: number; h: number }>): Seg[] =>
    rects.flatMap((rect) => [
      [rect.x, rect.y, rect.x + rect.w, rect.y],
      [rect.x + rect.w, rect.y, rect.x + rect.w, rect.y + rect.h],
      [rect.x + rect.w, rect.y + rect.h, rect.x, rect.y + rect.h],
      [rect.x, rect.y + rect.h, rect.x, rect.y],
    ] as Seg[])
  if (layout.glueRects?.length) page.pushOperators(...spotStroke('Glue', rectSegs(layout.glueRects), mapSeg, true))
  const films = (layout.overlays ?? []).filter((item) => item.kind === 'window-film')
  if (films.length) page.pushOperators(...spotStroke('WindowFilm', rectSegs(films), mapSeg, true))

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

  const dimGap = pt(6)
  const dimTick = pt(1.4)
  page.pushOperators(
    pushGraphicsState(),
    PDFOperator.of(PDFOperatorNames.BeginMarkedContentSequence, [PDFName.of('OC'), PDFName.of('Dimensions')]),
    setStrokingCmykColor(0, 0, 0, 1),
    setLineWidth(0.4),
    moveTo(trimX, trimY + trimH + dimGap),
    lineTo(trimX + trimW, trimY + trimH + dimGap),
    stroke(),
    moveTo(trimX, trimY + trimH + dimGap - dimTick),
    lineTo(trimX, trimY + trimH + dimGap + dimTick),
    stroke(),
    moveTo(trimX + trimW, trimY + trimH + dimGap - dimTick),
    lineTo(trimX + trimW, trimY + trimH + dimGap + dimTick),
    stroke(),
    moveTo(trimX + trimW + dimGap, trimY),
    lineTo(trimX + trimW + dimGap, trimY + trimH),
    stroke(),
    moveTo(trimX + trimW + dimGap - dimTick, trimY),
    lineTo(trimX + trimW + dimGap + dimTick, trimY),
    stroke(),
    moveTo(trimX + trimW + dimGap - dimTick, trimY + trimH),
    lineTo(trimX + trimW + dimGap + dimTick, trimY + trimH),
    stroke(),
    endMarkedContent(),
    popGraphicsState()
  )

  let font
  try {
    const bytes = readFileSync(join(process.cwd(), 'src/lib/wedding/fonts/BeVietnamPro-Regular.ttf'))
    font = await pdfDoc.embedFont(bytes, { subset: true, customName: 'NANOAI+BeVietnamPro-Regular' })
  } catch {
    font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  }
  const rawLines = [...input.legend, ...input.warnings.map((item) => item.message)]
  const maxWidth = pageW - pt(12)
  const wrapped: string[] = []
  for (const line of rawLines) {
    const text = line.length > 180 ? `${line.slice(0, 177)}…` : line
    let rest = text
    while (rest.length > 0) {
      let take = rest.length
      while (take > 1 && font.widthOfTextAtSize(rest.slice(0, take), 8) > maxWidth) take -= 1
      const broken = take < rest.length ? rest.slice(0, take).replace(/\s+\S*$/, '') || rest.slice(0, take) : rest
      wrapped.push(broken)
      rest = rest.slice(broken.length).trimStart()
      if (wrapped.length >= 8) break
    }
    if (wrapped.length >= 8) break
  }
  const ink = cmyk(0, 0, 0, 1)
  wrapped.forEach((line, index) => {
    const y = pt(4) + (wrapped.length - 1 - index) * 10
    try {
      page.drawText(line, { x: pt(6), y, size: 8, font, color: ink, maxWidth })
    } catch {
      const plain = line.normalize('NFD').replace(/[^\x20-\x7E]/g, ' ')
      page.drawText(plain, { x: pt(6), y, size: 8, font, color: ink, maxWidth })
    }
  })
  const xmlEscape = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const stamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
  const xmp = `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about="" xmlns:pdfxid="http://www.npes.org/pdfx/ns/id/" xmlns:pdf="http://ns.adobe.com/pdf/1.3/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmp="http://ns.adobe.com/xap/1.0/">
   <pdfxid:GTS_PDFXVersion>PDF/X-4</pdfxid:GTS_PDFXVersion>
   <pdf:Trapped>False</pdf:Trapped>
   <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${xmlEscape(input.title)}</rdf:li></rdf:Alt></dc:title>
   <xmp:CreateDate>${stamp}</xmp:CreateDate>
   <xmp:ModifyDate>${stamp}</xmp:ModifyDate>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`
  const metadata = pdfDoc.context.stream(Buffer.from(xmp, 'utf8'), { Type: 'Metadata', Subtype: 'XML' })
  pdfDoc.catalog.set(PDFName.of('Metadata'), pdfDoc.context.register(metadata))

  pdfDoc.setTitle(input.title)
  pdfDoc.setProducer('NanoAI dieline PDF/X-4')
  pdfDoc.setCreator('NanoAI')
  const saved = Buffer.from(await pdfDoc.save({ useObjectStreams: false }))
  const header = Buffer.from('%PDF-1.6')
  if (saved.subarray(0, 8).toString('latin1') === '%PDF-1.7') header.copy(saved, 0)
  return saved
}
