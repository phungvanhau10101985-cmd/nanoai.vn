import type { BoxFaceSlot } from '@/lib/packaging/box-face-slots'
import type { BoxDimensions, TuckEndLayoutData } from '@/lib/packaging/box-net-svg'
import {
  structureUsesBodyStrip,
  type BoxDielineStructure,
} from '@/lib/packaging/dieline-structure'
import { dielineArtworkRotation } from '@/lib/packaging/dieline-orientation'
import { lidDepthExtraMm, TUCK_SIDE_RELIEF_MM } from '@/lib/packaging/paper-stock'
import {
  normalizeTuckBoxProductionParams,
  type TuckBoxProductionParams,
} from '@/lib/packaging/tuck-box-production'

type Pt = { x: number; y: number }
type Seg = [number, number, number, number]
type Rect = { x: number; y: number; w: number; h: number }
type Flap = { slot: BoxFaceSlot; x: number; y: number; w: number; h: number }

type Build = {
  panels: TuckEndLayoutData['panels']
  cuts: Seg[]
  folds: Seg[]
  glueRects: Rect[]
  flaps: Flap[]
  knockouts: NonNullable<TuckEndLayoutData['knockouts']>
  fingerNotches: NonNullable<TuckEndLayoutData['fingerNotches']>
  glueTabMm: number
  tuckTabMm: number
  widthMm: number
  heightMm: number
  legend: string[]
}

function r3(n: number): number {
  return Math.round(n * 1000) / 1000
}

function dedupe(pts: Pt[]): Pt[] {
  const out: Pt[] = []
  for (const pt of pts) {
    const last = out[out.length - 1]
    if (!last || Math.hypot(pt.x - last.x, pt.y - last.y) > 0.04) out.push(pt)
  }
  return out
}

function segsOf(pts: Pt[]): Seg[] {
  const clean = dedupe(pts)
  const out: Seg[] = []
  for (let i = 0; i < clean.length - 1; i += 1) {
    const a = clean[i]!
    const b = clean[i + 1]!
    out.push([r3(a.x), r3(a.y), r3(b.x), r3(b.y)])
  }
  return out
}

function arcPoints(cx: number, cy: number, radius: number, a0: number, a1: number, steps = 8): Pt[] {
  const pts: Pt[] = []
  const n = Math.max(2, steps)
  for (let i = 0; i <= n; i += 1) {
    const t = a0 + ((a1 - a0) * i) / n
    pts.push({ x: cx + radius * Math.cos(t), y: cy + radius * Math.sin(t) })
  }
  return pts
}

function fillet(prev: Pt, corner: Pt, next: Pt, radius: number): Pt[] {
  const d1 = Math.hypot(prev.x - corner.x, prev.y - corner.y)
  const d2 = Math.hypot(next.x - corner.x, next.y - corner.y)
  const used = Math.min(radius, d1 * 0.46, d2 * 0.46)
  if (used < 0.25 || d1 < 0.05 || d2 < 0.05) return [corner]
  const p0 = {
    x: corner.x + ((prev.x - corner.x) / d1) * used,
    y: corner.y + ((prev.y - corner.y) / d1) * used,
  }
  const p1 = {
    x: corner.x + ((next.x - corner.x) / d2) * used,
    y: corner.y + ((next.y - corner.y) / d2) * used,
  }
  const pts: Pt[] = []
  const n = 6
  for (let i = 0; i <= n; i += 1) {
    const t = i / n
    const u = 1 - t
    pts.push({
      x: u * u * p0.x + 2 * u * t * corner.x + t * t * p1.x,
      y: u * u * p0.y + 2 * u * t * corner.y + t * t * p1.y,
    })
  }
  return pts
}

function roundCorners(pts: Pt[], indexes: number[], radius: number): Pt[] {
  const marked = new Set(indexes)
  const out: Pt[] = []
  for (let i = 0; i < pts.length; i += 1) {
    if (!marked.has(i) || i === 0 || i === pts.length - 1) {
      out.push(pts[i]!)
      continue
    }
    out.push(...fillet(pts[i - 1]!, pts[i]!, pts[i + 1]!, radius))
  }
  return dedupe(out)
}

function circle(cx: number, cy: number, radius: number, steps = 40): Pt[] {
  const pts = arcPoints(cx, cy, radius, 0, Math.PI * 2, steps)
  pts.push(pts[0]!)
  return pts
}

function roundedRect(rect: Rect, radius: number): Pt[] {
  const r = Math.min(radius, rect.w / 2 - 0.2, rect.h / 2 - 0.2)
  const x = rect.x
  const y = rect.y
  const x2 = rect.x + rect.w
  const y2 = rect.y + rect.h
  if (r < 0.4) {
    return [
      { x, y },
      { x: x2, y },
      { x: x2, y: y2 },
      { x, y: y2 },
      { x, y },
    ]
  }
  return dedupe([
    { x: x + r, y },
    ...fillet({ x: x + r, y }, { x: x2, y }, { x: x2, y: y + r }, r),
    { x: x2, y: y2 - r },
    ...fillet({ x: x2, y: y2 - r }, { x: x2, y: y2 }, { x: x2 - r, y: y2 }, r),
    { x: x + r, y: y2 },
    ...fillet({ x: x + r, y: y2 }, { x, y: y2 }, { x, y: y2 - r }, r),
    { x, y: y + r },
    ...fillet({ x, y: y + r }, { x, y }, { x: x + r, y }, r),
    { x: x + r, y },
  ])
}

type Resolved = {
  params: TuckBoxProductionParams
  compensate: boolean
  side: number
  lidExtra: number
  locks: boolean
  finger: boolean
}

function resolveProduction(heightMm: number, production?: Partial<TuckBoxProductionParams>): Resolved {
  if (!production) {
    const params = normalizeTuckBoxProductionParams(undefined, heightMm)
    return {
      params: { ...params, fingerNotch: false, lockDetails: false },
      compensate: false,
      side: 0,
      lidExtra: 0,
      locks: false,
      finger: false,
    }
  }
  const params = normalizeTuckBoxProductionParams(production, heightMm)
  return {
    params,
    compensate: true,
    side: TUCK_SIDE_RELIEF_MM,
    lidExtra: lidDepthExtraMm(params.paperThicknessMm),
    locks: params.lockDetails,
    finger: params.fingerNotch,
  }
}

function panel(
  structure: BoxDielineStructure,
  slot: BoxFaceSlot,
  x: number,
  y: number,
  w: number,
  h: number
): TuckEndLayoutData['panels'][number] {
  return { x, y, w, h, slot, rotation: dielineArtworkRotation(structure, slot) }
}

function shiftBuild(build: Build) {
  let minX = 0
  let minY = 0
  let maxX = build.widthMm
  let maxY = build.heightMm
  const see = (x: number, y: number) => {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  for (const seg of [...build.cuts, ...build.folds]) {
    see(seg[0], seg[1])
    see(seg[2], seg[3])
  }
  const dx = minX < 2 ? 2 - minX : 0
  const dy = minY < 2 ? 2 - minY : 0
  if (dx === 0 && dy === 0) {
    build.widthMm = Math.max(build.widthMm, maxX + 2)
    build.heightMm = Math.max(build.heightMm, maxY + 2)
    return
  }
  const moveSeg = (seg: Seg): Seg => [r3(seg[0] + dx), r3(seg[1] + dy), r3(seg[2] + dx), r3(seg[3] + dy)]
  build.cuts = build.cuts.map(moveSeg)
  build.folds = build.folds.map(moveSeg)
  const moveRect = <T extends Rect>(rect: T): T => ({ ...rect, x: rect.x + dx, y: rect.y + dy })
  build.panels = build.panels.map(moveRect)
  build.glueRects = build.glueRects.map(moveRect)
  build.flaps = build.flaps.map(moveRect)
  build.knockouts = build.knockouts.map(moveRect)
  build.fingerNotches = build.fingerNotches.map((notch) => ({ ...notch, cx: notch.cx + dx, cy: notch.cy + dy }))
  build.widthMm = maxX + dx + 2
  build.heightMm = maxY + dy + 2
}

function finish(structure: BoxDielineStructure, build: Build): TuckEndLayoutData {
  shiftBuild(build)
  return {
    panels: build.panels,
    cutSegments: build.cuts,
    foldSegments: build.folds,
    bounds: { widthMm: build.widthMm, heightMm: build.heightMm },
    glueTabMm: build.glueTabMm,
    tuckTabMm: build.tuckTabMm,
    glueRects: build.glueRects,
    flapExtensions: build.flaps,
    knockouts: build.knockouts,
    fingerNotches: build.fingerNotches,
    bodyStrip: structureUsesBodyStrip(structure),
    legendLines: build.legend,
  }
}

function emptyBuild(glue: number, tuck: number): Build {
  return {
    panels: [],
    cuts: [],
    folds: [],
    glueRects: [],
    flaps: [],
    knockouts: [],
    fingerNotches: [],
    glueTabMm: glue,
    tuckTabMm: tuck,
    widthMm: 0,
    heightMm: 0,
    legend: [],
  }
}

function pushLine(target: Seg[], x1: number, y1: number, x2: number, y2: number) {
  if (Math.hypot(x2 - x1, y2 - y1) <= 0.04) return
  target.push([r3(x1), r3(y1), r3(x2), r3(y2)])
}

function tuckOutline(
  xL: number,
  xR: number,
  yAttach: number,
  depth: number,
  dir: 1 | -1,
  side: number,
  locks: boolean,
  finger: boolean,
  slot: BoxFaceSlot
): { cuts: Seg[]; slits: Seg[]; notch?: Build['fingerNotches'][number] } {
  const left = xL + side
  const right = xR - side
  const yOuter = yAttach + dir * depth
  const neck = Math.min(2.4, depth * 0.22)
  const sharp: Pt[] = [
    { x: xL, y: yAttach },
    { x: left, y: yAttach + dir * neck },
    { x: left, y: yOuter },
    { x: right, y: yOuter },
    { x: right, y: yAttach + dir * neck },
    { x: xR, y: yAttach },
  ]
  const radius = Math.min(3.5, depth * 0.34, Math.max(0, right - left) / 5)
  const rounded = roundCorners(sharp, [2, 3], radius)
  void locks
  void finger
  void slot
  return { cuts: segsOf(rounded), slits: [] }
}

function dustOutline(
  xL: number,
  xR: number,
  yFold: number,
  depth: number,
  dir: 1 | -1,
  side: number,
  shoulder: 'left' | 'right' | 'none'
): Pt[] {
  const left = xL + side
  const right = xR - side
  const yOuter = yFold + dir * depth
  const hook = Math.min(2.2, Math.max(0, (right - left) * 0.18))
  const pts: Pt[] = [{ x: xL, y: yFold }]
  if (shoulder === 'left' && hook > 0.8) {
    pts.push(
      { x: xL + 0.8, y: yFold + dir * 2 },
      { x: xL + 0.8 + hook, y: yFold + dir * 4.2 },
      { x: xL + 0.8, y: yFold + dir * 6.6 },
      { x: left, y: yOuter }
    )
  } else {
    pts.push({ x: left, y: yOuter })
  }
  pts.push({ x: right, y: yOuter })
  if (shoulder === 'right' && hook > 0.8) {
    pts.push(
      { x: xR - 0.8, y: yFold + dir * 6.6 },
      { x: xR - 0.8 - hook, y: yFold + dir * 4.2 },
      { x: xR - 0.8, y: yFold + dir * 2 }
    )
  }
  pts.push({ x: xR, y: yFold })
  return dedupe(pts)
}

function hingeLine(build: Build, xL: number, xR: number, y: number, locks: boolean) {
  if (!locks || xR - xL < 16) {
    pushLine(build.folds, xL, y, xR, y)
    return
  }
  const slit = Math.min(5, (xR - xL) * 0.12)
  pushLine(build.cuts, xL, y, xL + slit, y)
  pushLine(build.folds, xL + slit, y, xR - slit, y)
  pushLine(build.cuts, xR - slit, y, xR, y)
}

function pushReceivingNotch(
  build: Build,
  xL: number,
  xR: number,
  y: number,
  into: 1 | -1,
  enabled: boolean,
  slot: BoxFaceSlot
) {
  const span = xR - xL
  const radius = Math.min(8, span * 0.16)
  if (!enabled || span < 18 || radius < 3.5) {
    pushLine(build.cuts, xL, y, xR, y)
    return
  }
  const cx = (xL + xR) / 2
  const arc =
    into > 0
      ? arcPoints(cx, y, radius, Math.PI, 0, 8)
      : arcPoints(cx, y, radius, Math.PI, Math.PI * 2, 8)
  pushLine(build.cuts, xL, y, cx - radius, y)
  build.cuts.push(...segsOf(arc))
  pushLine(build.cuts, cx + radius, y, xR, y)
  build.fingerNotches.push({
    cx,
    cy: y,
    r: radius,
    slot,
    edge: into > 0 ? 'top' : 'bottom',
  })
}

type BottomKind = 'reverse' | 'straight' | 'crash' | 'snap' | 'none'
type TopKind = 'tuck' | 'none'

function buildTuckFamily(
  structure: BoxDielineStructure,
  d: BoxDimensions,
  resolved: Resolved,
  bottom: BottomKind,
  top: TopKind
): Build {
  const { lengthMm: L, widthMm: W, heightMm: H } = d
  const pad = 2
  const glue = resolved.params.glueTabMm
  const lidDepth = W + resolved.lidExtra
  const tuckTab = Math.max(12, Math.min(18, W * 0.28))
  const dustDepth = Math.max(8, Math.min(lidDepth * 0.46, L * 0.42))
  const x0 = pad
  const x1 = x0 + L
  const x2 = x1 + W
  const x3 = x2 + L
  const x4 = x3 + W
  const topLid = top === 'tuck' ? lidDepth : 0
  const topTuck = top === 'tuck' ? tuckTab : 0
  const bodyTop = pad + topTuck + topLid
  const bodyBottom = bodyTop + H
  const build = emptyBuild(glue, top === 'tuck' || bottom === 'reverse' || bottom === 'straight' ? tuckTab : 0)
  const cuts = build.cuts
  const folds = build.folds

  build.panels.push(
    panel(structure, 'front', x0, bodyTop, L, H),
    panel(structure, 'right', x1, bodyTop, W, H),
    panel(structure, 'back', x2, bodyTop, L, H),
    panel(structure, 'left', x3, bodyTop, W, H)
  )

  pushLine(folds, x1, bodyTop, x1, bodyBottom)
  pushLine(folds, x2, bodyTop, x2, bodyBottom)
  pushLine(folds, x3, bodyTop, x3, bodyBottom)
  pushLine(folds, x4, bodyTop, x4, bodyBottom)

  const glueInset = Math.min(4, H * 0.08)
  cuts.push(
    ...segsOf([
      { x: x4, y: bodyTop },
      { x: x4 + glue, y: bodyTop + glueInset },
      { x: x4 + glue, y: bodyBottom - glueInset },
      { x: x4, y: bodyBottom },
    ])
  )
  build.glueRects.push({ x: x4, y: bodyTop, w: glue, h: H })

  let netBottom = bodyBottom

  if (top === 'tuck') {
    const yLidOuter = bodyTop - lidDepth
    const yTuckOuter = yLidOuter - tuckTab
    build.panels.push(panel(structure, 'top', x0, yLidOuter, L, lidDepth))
    pushLine(folds, x0, bodyTop, x1, bodyTop)
    const tuck = tuckOutline(x0, x1, yLidOuter, tuckTab, -1, resolved.side, resolved.locks, false, 'top')
    cuts.push(...tuck.cuts, ...tuck.slits)
    build.flaps.push({ slot: 'top', x: x0 + resolved.side, y: yTuckOuter, w: L - resolved.side * 2, h: tuckTab })
    pushLine(cuts, x0, bodyTop, x0, yLidOuter)
    pushLine(cuts, x1, bodyTop, x1, yLidOuter)
    hingeLine(build, x0, x1, yLidOuter, resolved.locks)
    addTopDust(build, x1, x2, bodyTop, dustDepth, resolved, 'left', 'right')
    addTopDust(build, x3, x4, bodyTop, dustDepth, resolved, 'none', 'left')
    pushReceivingNotch(build, x2, x3, bodyTop, 1, resolved.finger, 'back')
  } else {
    pushLine(cuts, x0, bodyTop, x4, bodyTop)
  }

  if (bottom === 'reverse' || bottom === 'straight') {
    const xL = bottom === 'straight' ? x0 : x2
    const xR = xL + L
    const yLidOuter = bodyBottom + lidDepth
    const yTuckOuter = yLidOuter + tuckTab
    build.panels.push(panel(structure, 'bottom', xL, bodyBottom, L, lidDepth))
    pushLine(folds, xL, bodyBottom, xR, bodyBottom)
    hingeLine(build, xL, xR, yLidOuter, resolved.locks)
    const tuck = tuckOutline(xL, xR, yLidOuter, tuckTab, 1, resolved.side, resolved.locks, false, 'bottom')
    cuts.push(...tuck.cuts, ...tuck.slits)
    build.flaps.push({
      slot: 'bottom',
      x: xL + resolved.side,
      y: yLidOuter,
      w: L - resolved.side * 2,
      h: tuckTab,
    })
    pushLine(cuts, xL, bodyBottom, xL, yLidOuter)
    pushLine(cuts, xR, bodyBottom, xR, yLidOuter)
    const openLeft = bottom === 'straight' ? x2 : x0
    const openRight = bottom === 'straight' ? x3 : x1
    pushLine(cuts, openLeft, bodyBottom, openRight, bodyBottom)
    if (bottom === 'reverse') {
      addBottomDust(build, x1, x2, bodyBottom, dustDepth, resolved, 'right', 'right')
      addBottomDust(build, x3, x4, bodyBottom, dustDepth, resolved, 'left', 'left')
    } else {
      addBottomDust(build, x1, x2, bodyBottom, dustDepth, resolved, 'left', 'right')
      addBottomDust(build, x3, x4, bodyBottom, dustDepth, resolved, 'none', 'left')
    }
    netBottom = yTuckOuter
  } else if (bottom === 'crash') {
    netBottom = Math.max(netBottom, addCrashBottom(build, { x0, x1, x2, x3, x4, bodyBottom, L, W, lidExtra: resolved.lidExtra }))
  } else if (bottom === 'snap') {
    netBottom = Math.max(netBottom, addSnapBottom(build, { x0, x1, x2, x3, x4, bodyBottom, L, W, lidExtra: resolved.lidExtra }))
  } else {
    pushLine(cuts, x0, bodyBottom, x4, bodyBottom)
  }

  pushLine(cuts, x0, bodyTop, x0, bodyBottom)

  build.widthMm = x4 + glue + pad
  build.heightMm = netBottom + pad
  build.legend.push(
    `L ${L} mm · W ${W} mm · H ${H} mm`,
    `Giấy ${resolved.params.paperThicknessMm} mm · nắp/đáy +${resolved.lidExtra} mm`,
    `Tai dán ${glue} mm · hẹp lưỡi/tai ${resolved.side} mm/bên`
  )
  return build
}

function addTopDust(
  build: Build,
  xL: number,
  xR: number,
  bodyTop: number,
  depth: number,
  resolved: Resolved,
  shoulder: 'left' | 'right' | 'none',
  slot: BoxFaceSlot
) {
  const usedShoulder = resolved.locks ? shoulder : 'none'
  const yOuter = bodyTop - depth
  build.cuts.push(...segsOf(dustOutline(xL, xR, bodyTop, depth, -1, resolved.side, usedShoulder)))
  pushLine(build.folds, xL, bodyTop, xR, bodyTop)
  build.flaps.push({
    slot,
    x: xL + resolved.side,
    y: yOuter,
    w: xR - xL - resolved.side * 2,
    h: depth,
  })
}

function addBottomDust(
  build: Build,
  xL: number,
  xR: number,
  bodyBottom: number,
  depth: number,
  resolved: Resolved,
  shoulder: 'left' | 'right' | 'none',
  slot: BoxFaceSlot
) {
  const usedShoulder = resolved.locks ? shoulder : 'none'
  build.cuts.push(...segsOf(dustOutline(xL, xR, bodyBottom, depth, 1, resolved.side, usedShoulder)))
  pushLine(build.folds, xL, bodyBottom, xR, bodyBottom)
  build.flaps.push({
    slot,
    x: xL + resolved.side,
    y: bodyBottom,
    w: xR - xL - resolved.side * 2,
    h: depth,
  })
}

function addCrashBottom(
  build: Build,
  box: { x0: number; x1: number; x2: number; x3: number; x4: number; bodyBottom: number; L: number; W: number; lidExtra: number }
): number {
  const depth = box.W / 2 + box.lidExtra
  const y0 = box.bodyBottom
  const y1 = y0 + depth
  const gap = 0
  const major = (xL: number, xR: number, mirror: boolean) => {
    const a = xL + gap
    const b = xR - gap
    const w = b - a
    const pts: Pt[] = mirror
      ? [
          { x: a, y: y0 },
          { x: a, y: y0 + depth * 0.55 },
          { x: a + w * 0.08, y: y1 },
          { x: b - w * 0.12, y: y1 },
          { x: b, y: y0 + depth * 0.2 },
          { x: b, y: y0 },
        ]
      : [
          { x: a, y: y0 },
          { x: a, y: y0 + depth * 0.2 },
          { x: a + w * 0.12, y: y1 },
          { x: b - w * 0.08, y: y1 },
          { x: b, y: y0 + depth * 0.55 },
          { x: b, y: y0 },
        ]
    build.cuts.push(...segsOf(pts))
    pushLine(build.folds, xL, y0, xR, y0)
  }
  const minor = (xL: number, xR: number, mirror: boolean) => {
    const a = xL + gap
    const b = xR - gap
    const run = Math.min(b - a, depth)
    const knee = mirror ? b - run : a + run
    const pts: Pt[] = mirror
      ? [
          { x: a, y: y0 },
          { x: a, y: y0 + depth * 0.2 },
          { x: knee, y: y1 },
          { x: b, y: y1 },
          { x: b, y: y0 },
        ]
      : [
          { x: a, y: y0 },
          { x: a, y: y1 },
          { x: knee, y: y1 },
          { x: b, y: y0 + depth * 0.2 },
          { x: b, y: y0 },
        ]
    build.cuts.push(...segsOf(pts))
    pushLine(build.folds, xL, y0, xR, y0)
    pushLine(build.folds, mirror ? b : a, y0, knee, y1)
    build.glueRects.push(
      mirror
        ? { x: a, y: y0 + depth * 0.35, w: (b - a) * 0.5, h: depth * 0.65 }
        : { x: knee, y: y0 + depth * 0.35, w: b - knee, h: depth * 0.65 }
    )
  }
  major(box.x0, box.x1, false)
  minor(box.x1, box.x2, false)
  major(box.x2, box.x3, true)
  minor(box.x3, box.x4, true)
  build.legend.push('Đáy khóa tự động: cánh lớn trên mặt dài, cánh nhỏ có đường chéo dán.')
  return y1
}

function addSnapBottom(
  build: Build,
  box: { x0: number; x1: number; x2: number; x3: number; x4: number; bodyBottom: number; L: number; W: number; lidExtra: number }
): number {
  const depth = Math.max(14, box.W * 0.48 + box.lidExtra)
  const tongue = 12
  const y0 = box.bodyBottom
  const inset = 1
  const flap = (xL: number, xR: number, h: number) => {
    const pts = [
      { x: xL, y: y0 },
      { x: xL + inset, y: y0 + h },
      { x: xR - inset, y: y0 + h },
      { x: xR, y: y0 },
    ]
    build.cuts.push(...segsOf(pts))
    pushLine(build.folds, xL, y0, xR, y0)
  }
  flap(box.x0, box.x1, depth)
  flap(box.x2, box.x3, depth)
  const leftW = box.x4 - box.x3
  flap(box.x3, box.x4, depth * 0.92)
  const slitW = Math.min(leftW * 0.46, box.L * 0.28)
  const slitX = box.x3 + (leftW - slitW) / 2
  const slitY = y0 + depth * 0.55
  pushLine(build.cuts, slitX, slitY, slitX + slitW, slitY)
  const tongueW = Math.min(leftW * 0.42, slitW * 0.85)
  const tx = box.x1 + (box.W - tongueW) / 2
  const yTongue = y0 + depth
  build.cuts.push(
    ...segsOf(
      roundCorners(
        [
          { x: box.x1, y: y0 },
          { x: box.x1 + inset, y: y0 + depth },
          { x: tx, y: y0 + depth },
          { x: tx, y: yTongue + tongue },
          { x: tx + tongueW, y: yTongue + tongue },
          { x: tx + tongueW, y: y0 + depth },
          { x: box.x2 - inset, y: y0 + depth },
          { x: box.x2, y: y0 },
        ],
        [3, 4],
        2.5
      )
    )
  )
  pushLine(build.folds, box.x1, y0, box.x2, y0)
  build.legend.push('Đáy 1-2-3: lưỡi ở mặt hông phải gài vào khe mặt hông trái.')
  return y0 + depth + tongue
}

function placeTray(
  build: Build,
  structure: BoxDielineStructure,
  originX: number,
  originY: number,
  innerL: number,
  innerW: number,
  wallH: number,
  glue: number,
  floor: BoxFaceSlot | null,
  walls: { front?: BoxFaceSlot; back?: BoxFaceSlot; left?: BoxFaceSlot; right?: BoxFaceSlot }
): { width: number; height: number } {
  const fx = originX + wallH
  const fy = originY + wallH
  if (floor) build.panels.push(panel(structure, floor, fx, fy, innerL, innerW))
  if (walls.back) build.panels.push(panel(structure, walls.back, fx, originY, innerL, wallH))
  if (walls.front) build.panels.push(panel(structure, walls.front, fx, fy + innerW, innerL, wallH))
  if (walls.left) build.panels.push(panel(structure, walls.left, originX, fy, wallH, innerW))
  if (walls.right) build.panels.push(panel(structure, walls.right, fx + innerL, fy, wallH, innerW))
  pushLine(build.folds, fx, fy, fx + innerL, fy)
  pushLine(build.folds, fx, fy + innerW, fx + innerL, fy + innerW)
  pushLine(build.folds, fx, fy, fx, fy + innerW)
  pushLine(build.folds, fx + innerL, fy, fx + innerL, fy + innerW)
  const tab = Math.min(14, Math.max(10, glue))
  const addFlap = (x1: number, x2: number, yEdge: number, dir: 1 | -1) => {
    const xa = Math.min(x1, x2)
    const xb = Math.max(x1, x2)
    const yTip = yEdge + dir * tab
    const inset = Math.min(1.5, (xb - xa) * 0.12)
    build.cuts.push(
      ...segsOf([
        { x: xa, y: yEdge },
        { x: xa + inset, y: yTip },
        { x: xb - inset, y: yTip },
        { x: xb, y: yEdge },
      ])
    )
    pushLine(build.folds, xa, yEdge, xb, yEdge)
    build.glueRects.push({
      x: xa,
      y: Math.min(yEdge, yTip),
      w: xb - xa,
      h: tab,
    })
  }
  build.cuts.push(
    ...segsOf([
      { x: fx, y: fy },
      { x: fx, y: originY },
      { x: fx + innerL, y: originY },
      { x: fx + innerL, y: fy },
    ])
  )
  build.cuts.push(
    ...segsOf([
      { x: fx, y: fy + innerW },
      { x: fx, y: fy + innerW + wallH },
      { x: fx + innerL, y: fy + innerW + wallH },
      { x: fx + innerL, y: fy + innerW },
    ])
  )
  pushLine(build.cuts, originX, fy, originX, fy + innerW)
  pushLine(build.cuts, fx + innerL + wallH, fy, fx + innerL + wallH, fy + innerW)
  addFlap(originX, fx, fy, -1)
  addFlap(originX, fx, fy + innerW, 1)
  addFlap(fx + innerL, fx + innerL + wallH, fy, -1)
  addFlap(fx + innerL, fx + innerL + wallH, fy + innerW, 1)
  return { width: innerL + wallH * 2, height: innerW + wallH * 2 }
}

function buildTelescope(structure: BoxDielineStructure, d: BoxDimensions, resolved: Resolved): Build {
  const { lengthMm: L, widthMm: W, heightMm: H } = d
  const t = resolved.params.paperThicknessMm
  const clearance = 0.6
  const lidL = L + 2 * t + clearance
  const lidW = W + 2 * t + clearance
  const lidWall = Math.max(16, Math.min(H * 0.45, Math.max(16, H - 4)))
  const baseWall = H
  const gap = 14
  const glue = resolved.params.glueTabMm
  const build = emptyBuild(glue, 0)
  const base = placeTray(build, structure, 2, 2, L, W, baseWall, glue, 'bottom', {})
  placeTray(build, structure, 2 + base.width + gap, 2, lidL, lidW, lidWall, glue, 'top', {
    front: 'front',
    back: 'back',
    left: 'left',
    right: 'right',
  })
  build.widthMm = 2 + base.width + gap + lidL + lidWall * 2 + 2
  build.heightMm = Math.max(base.height, lidW + lidWall * 2) + 4
  build.legend.push(
    `Đáy lòng ${L}×${W}×${H} mm`,
    `Nắp lòng ${r3(lidL)}×${r3(lidW)} mm, thành ${r3(lidWall)} mm`,
    'Hai mảnh rời. Nắp chụp ngoài đáy.'
  )
  return build
}

function buildMagnetic(structure: BoxDielineStructure, d: BoxDimensions, resolved: Resolved): Build {
  const { lengthMm: L, widthMm: W, heightMm: H } = d
  const pad = 2
  const lidDepth = W + resolved.lidExtra
  const flapH = 22
  const x = pad + H
  let y = pad
  const build = emptyBuild(resolved.params.glueTabMm, 0)
  const flapW = Math.max(20, L - 8)
  const flapX = x + (L - flapW) / 2
  build.cuts.push(
    ...segsOf([
      { x: flapX, y: y + flapH },
      { x: flapX, y },
      { x: flapX + flapW, y },
      { x: flapX + flapW, y: y + flapH },
    ])
  )
  const magnetW = Math.min(28, flapW * 0.45)
  const magnetH = 12
  build.knockouts.push({
    x: flapX + (flapW - magnetW) / 2,
    y: y + (flapH - magnetH) / 2,
    w: magnetW,
    h: magnetH,
    kind: 'magnet',
    shape: 'rect',
  })
  y += flapH
  build.panels.push(panel(structure, 'top', x, y, L, lidDepth))
  pushLine(build.folds, flapX, y, flapX + flapW, y)
  pushLine(build.folds, x, y + lidDepth, x + L, y + lidDepth)
  build.panels.push(panel(structure, 'left', x - H, y, H, lidDepth))
  build.panels.push(panel(structure, 'right', x + L, y, H, lidDepth))
  pushLine(build.folds, x, y, x, y + lidDepth)
  pushLine(build.folds, x + L, y, x + L, y + lidDepth)
  pushLine(build.cuts, x - H, y, x - H, y + lidDepth)
  pushLine(build.cuts, x - H, y, x, y)
  pushLine(build.cuts, x - H, y + lidDepth, x, y + lidDepth)
  pushLine(build.cuts, x + L + H, y, x + L + H, y + lidDepth)
  pushLine(build.cuts, x + L, y, x + L + H, y)
  pushLine(build.cuts, x + L, y + lidDepth, x + L + H, y + lidDepth)
  y += lidDepth
  build.panels.push(panel(structure, 'back', x, y, L, H))
  y += H
  build.panels.push(panel(structure, 'bottom', x, y, L, W))
  pushLine(build.folds, x, y, x + L, y)
  pushLine(build.folds, x, y + W, x + L, y + W)
  build.panels.push(panel(structure, 'front', x, y + W, L, H))
  const frontTop = y + W
  build.knockouts.push({
    x: x + (L - magnetW) / 2,
    y: frontTop + H - magnetH - 6,
    w: magnetW,
    h: magnetH,
    kind: 'magnet',
    shape: 'rect',
  })
  pushLine(build.cuts, x, frontTop, x, frontTop + H)
  pushLine(build.cuts, x + L, frontTop, x + L, frontTop + H)
  pushLine(build.cuts, x, frontTop + H, x + L, frontTop + H)
  pushLine(build.folds, x, y, x, y + W)
  pushLine(build.folds, x + L, y, x + L, y + W)
  pushLine(build.cuts, x - H, y, x - H, y + W)
  pushLine(build.cuts, x - H, y, x, y)
  pushLine(build.cuts, x - H, y + W, x, y + W)
  pushLine(build.cuts, x + L + H, y, x + L + H, y + W)
  pushLine(build.cuts, x + L, y, x + L + H, y)
  pushLine(build.cuts, x + L, y + W, x + L + H, y + W)
  build.widthMm = x + L + H + pad
  build.heightMm = frontTop + H + pad
  build.legend.push('Vùng nam châm để trống mực. Nam châm dán sau, không bế thủng.')
  return build
}

function buildSleeveTray(structure: BoxDielineStructure, d: BoxDimensions, resolved: Resolved): Build {
  const { lengthMm: L, widthMm: W, heightMm: H } = d
  const glue = resolved.params.glueTabMm
  const pad = 2
  const build = emptyBuild(glue, 0)
  const x0 = pad
  const bodyTop = pad
  build.panels.push(
    panel(structure, 'front', x0, bodyTop, L, H),
    panel(structure, 'right', x0 + L, bodyTop, W, H),
    panel(structure, 'back', x0 + L + W, bodyTop, L, H),
    panel(structure, 'left', x0 + L + W + L, bodyTop, W, H)
  )
  const xEnd = x0 + 2 * L + 2 * W
  pushLine(build.folds, x0 + L, bodyTop, x0 + L, bodyTop + H)
  pushLine(build.folds, x0 + L + W, bodyTop, x0 + L + W, bodyTop + H)
  pushLine(build.folds, x0 + 2 * L + W, bodyTop, x0 + 2 * L + W, bodyTop + H)
  pushLine(build.folds, xEnd, bodyTop, xEnd, bodyTop + H)
  const inset = Math.min(4, H * 0.08)
  build.cuts.push(
    ...segsOf([
      { x: xEnd, y: bodyTop },
      { x: xEnd + glue, y: bodyTop + inset },
      { x: xEnd + glue, y: bodyTop + H - inset },
      { x: xEnd, y: bodyTop + H },
    ])
  )
  build.glueRects.push({ x: xEnd, y: bodyTop, w: glue, h: H })
  pushLine(build.cuts, x0, bodyTop, x0, bodyTop + H)
  const notchR = Math.min(10, L * 0.12)
  const nx = x0 + L / 2
  build.cuts.push(...segsOf([{ x: x0, y: bodyTop }, ...arcPoints(nx, bodyTop, notchR, Math.PI, 0, 8), { x: x0 + L, y: bodyTop }]))
  pushLine(build.cuts, x0 + L, bodyTop, xEnd, bodyTop)
  pushLine(build.cuts, x0, bodyTop + H, xEnd, bodyTop + H)
  build.fingerNotches.push({ cx: nx, cy: bodyTop, r: notchR, slot: 'front', edge: 'top' })
  const t = resolved.compensate ? resolved.params.paperThicknessMm : 0
  const trayLen = Math.max(24, H - 1)
  const trayWid = Math.max(16, Math.min(L, W) - 2 * t - 1.2)
  const trayWall = Math.max(12, Math.min(L, W) * 0.62)
  const trayX = xEnd + glue + 12
  placeTray(build, structure, trayX, pad, trayLen, trayWid, trayWall, Math.min(glue, 14), 'bottom', {})
  build.widthMm = trayX + trayLen + trayWall * 2 + pad
  build.heightMm = Math.max(H, trayWid + trayWall * 2) + pad * 2
  build.legend.push(`Khay trượt ${r3(trayLen)}×${r3(trayWid)} mm, thành ${r3(trayWall)} mm, dài gần hết ống.`)
  return build
}

function buildTray(structure: BoxDielineStructure, d: BoxDimensions, resolved: Resolved): Build {
  const wall = d.heightMm
  const glue = resolved.params.glueTabMm
  const build = emptyBuild(glue, 0)
  const size = placeTray(build, structure, 2, 2, d.lengthMm, d.widthMm, wall, glue, 'bottom', {
    front: 'front',
    back: 'back',
    left: 'left',
    right: 'right',
  })
  build.widthMm = size.width + 4
  build.heightMm = size.height + 4
  build.legend.push(`Khay thành cao ${wall} mm. Tai góc dán vào thành.`)
  return build
}

function flatPolygon(side: number, sides: number): Pt[] {
  let x = 0
  let y = 0
  let ang = 0
  const pts: Pt[] = []
  for (let i = 0; i < sides; i += 1) {
    pts.push({ x, y })
    x += Math.cos(ang) * side
    y += Math.sin(ang) * side
    ang += (Math.PI * 2) / sides
  }
  return pts
}

function placePolygonLid(
  build: Build,
  structure: BoxDielineStructure,
  slot: 'top' | 'bottom',
  xL: number,
  yBase: number,
  side: number,
  sides: number,
  dir: 1 | -1,
  tuck: number,
  relief: number
) {
  const verts = flatPolygon(side, sides)
  const screen = (pt: Pt): Pt => ({ x: xL + pt.x, y: yBase + (dir === 1 ? pt.y : -pt.y) })
  let far = 1
  let farScore = -1
  for (let i = 1; i < sides - 1; i += 1) {
    const score = (verts[i]!.y + verts[(i + 1) % sides]!.y) / 2
    if (score > farScore) {
      farScore = score
      far = i
    }
  }
  const path: Pt[] = []
  for (let i = 0; i < sides; i += 1) {
    const a = screen(verts[i]!)
    const b = screen(verts[(i + 1) % sides]!)
    if (i === 0) continue
    if (i === far) {
      const dx = b.x - a.x
      const dy = b.y - a.y
      const len = Math.hypot(dx, dy) || 1
      const inset = Math.min(relief, len * 0.12)
      const left = { x: a.x + (dx / len) * inset, y: a.y + (dy / len) * inset }
      const right = { x: b.x - (dx / len) * inset, y: b.y - (dy / len) * inset }
      const outward = dir === 1 ? 1 : -1
      path.push(
        a,
        left,
        { x: left.x, y: left.y + outward * tuck },
        { x: right.x, y: right.y + outward * tuck },
        right,
        b
      )
      continue
    }
    path.push(a)
  }
  path.push(screen(verts[0]!))
  build.cuts.push(...segsOf(path))
  const baseA = screen(verts[0]!)
  const baseB = screen(verts[1]!)
  pushLine(build.folds, baseA.x, baseA.y, baseB.x, baseB.y)
  const drawn = verts.map(screen)
  const minX = Math.min(...drawn.map((pt) => pt.x))
  const maxX = Math.max(...drawn.map((pt) => pt.x))
  const minY = Math.min(...drawn.map((pt) => pt.y))
  const maxY = Math.max(...drawn.map((pt) => pt.y))
  build.panels.push(panel(structure, slot, minX, minY, maxX - minX, maxY - minY))
}

function buildPrism(structure: BoxDielineStructure, d: BoxDimensions, resolved: Resolved, sides: 6 | 8): Build {
  const across = Math.max(d.lengthMm, d.widthMm)
  const sideW = sides === 6 ? across / Math.sqrt(3) : across / (1 + Math.SQRT2)
  const H = d.heightMm
  const glue = Math.min(resolved.params.glueTabMm, Math.max(8, sideW - 3))
  const tuck = Math.max(12, Math.min(18, sideW * 0.45))
  const pad = 2
  const build = emptyBuild(glue, tuck)
  const lidReach = Math.max(...flatPolygon(sideW, sides).map((pt) => pt.y))
  const bodyTop = pad + tuck + lidReach
  const x0 = pad + sideW / 2
  const slots: BoxFaceSlot[] = ['front', 'right', 'back', 'left']
  for (let i = 0; i < sides; i += 1) {
    const slot = slots[i % slots.length]!
    const x = x0 + i * sideW
    if (i < 4) build.panels.push(panel(structure, slot, x, bodyTop, sideW, H))
    if (i > 0) pushLine(build.folds, x, bodyTop, x, bodyTop + H)
  }
  const xEnd = x0 + sides * sideW
  pushLine(build.folds, xEnd, bodyTop, xEnd, bodyTop + H)
  const inset = Math.min(4, H * 0.08)
  build.cuts.push(
    ...segsOf([
      { x: xEnd, y: bodyTop },
      { x: xEnd + glue, y: bodyTop + inset },
      { x: xEnd + glue, y: bodyTop + H - inset },
      { x: xEnd, y: bodyTop + H },
    ])
  )
  build.glueRects.push({ x: xEnd, y: bodyTop, w: glue, h: H })
  placePolygonLid(build, structure, 'top', x0, bodyTop, sideW, sides, -1, tuck, resolved.side)
  const backIndex = Math.floor(sides / 2)
  const bx = x0 + backIndex * sideW
  placePolygonLid(build, structure, 'bottom', bx, bodyTop + H, sideW, sides, 1, tuck, resolved.side)
  pushReceivingNotch(build, bx, bx + sideW, bodyTop, 1, resolved.finger, 'back')
  pushLine(build.cuts, x0, bodyTop, x0, bodyTop + H)
  for (let i = 0; i < sides; i += 1) {
    const x = x0 + i * sideW
    if (i !== 0 && i !== backIndex) pushLine(build.cuts, x, bodyTop, x + sideW, bodyTop)
    if (i !== backIndex) pushLine(build.cuts, x, bodyTop + H, x + sideW, bodyTop + H)
  }
  build.widthMm = xEnd + glue + pad + sideW
  build.heightMm = bodyTop + H + lidReach + tuck + pad
  build.legend.push(`${sides} cạnh, mỗi cạnh ${r3(sideW)} mm. Nắp đa giác bằng miệng hộp.`)
  return build
}

function buildPillow(structure: BoxDielineStructure, d: BoxDimensions, resolved: Resolved): Build {
  const L = d.lengthMm
  const face = d.heightMm
  const end = Math.min(d.widthMm * 0.42, L * 0.22)
  const glue = resolved.params.glueTabMm
  const pad = 2
  const x = pad + end
  const y = pad
  const build = emptyBuild(glue, 0)
  build.panels.push(panel(structure, 'front', x, y, L, face), panel(structure, 'back', x, y + face, L, face))
  pushLine(build.folds, x, y + face, x + L, y + face)
  const leftTip = { x: pad, y: y + face }
  const rightTip = { x: x + L + end, y: y + face }
  const curve = (from: Pt, tip: Pt, to: Pt) => {
    const pts: Pt[] = []
    for (let i = 0; i <= 10; i += 1) {
      const t = i / 10
      const u = 1 - t
      pts.push({
        x: u * u * from.x + 2 * u * t * tip.x + t * t * to.x,
        y: u * u * from.y + 2 * u * t * tip.y + t * t * to.y,
      })
    }
    return pts
  }
  const bottom = y + 2 * face
  build.cuts.push(
    ...segsOf([
      { x, y },
      { x: x + L, y },
      ...curve({ x: x + L, y }, { x: rightTip.x, y: y + face * 0.35 }, rightTip),
      ...curve(rightTip, { x: rightTip.x, y: y + face * 1.65 }, { x: x + L, y: bottom }),
      { x: x + L, y: bottom + glue },
      { x, y: bottom + glue },
      { x, y: bottom },
      ...curve({ x, y: bottom }, { x: leftTip.x, y: y + face * 1.65 }, leftTip),
      ...curve(leftTip, { x: leftTip.x, y: y + face * 0.35 }, { x, y }),
    ])
  )
  pushLine(build.folds, x, bottom, x + L, bottom)
  build.glueRects.push({ x, y: bottom, w: L, h: glue })
  build.flaps.push({ slot: 'front', x: pad, y, w: end, h: face }, { slot: 'front', x: x + L, y, w: end, h: face })
  build.widthMm = x + L + end + pad
  build.heightMm = bottom + glue + pad
  build.legend.push('Hộp gối: gấp đôi theo đường giữa, tai dán liền mép dưới.')
  return build
}

function buildTube(structure: BoxDielineStructure, d: BoxDimensions, resolved: Resolved): Build {
  const diameter = Math.min(d.lengthMm, d.widthMm)
  const thick = resolved.compensate ? resolved.params.paperThicknessMm : 0
  const radius = diameter / 2
  const circ = Math.PI * (diameter + thick)
  const topInner = radius + 2 * thick + 0.8
  const bottomInner = Math.max(6, radius - 0.8)
  const H = d.heightMm
  const glue = resolved.params.glueTabMm
  const skirt = 10
  const pad = 2
  const gap = 12
  const build = emptyBuild(glue, 0)
  build.panels.push(panel(structure, 'front', pad, pad, circ, H))
  pushLine(build.cuts, pad, pad, pad, pad + H)
  pushLine(build.cuts, pad, pad, pad + circ, pad)
  pushLine(build.cuts, pad, pad + H, pad + circ, pad + H)
  const xGlue = pad + circ
  build.cuts.push(
    ...segsOf([
      { x: xGlue, y: pad },
      { x: xGlue + glue, y: pad + 3 },
      { x: xGlue + glue, y: pad + H - 3 },
      { x: xGlue, y: pad + H },
    ])
  )
  build.glueRects.push({ x: xGlue, y: pad, w: glue, h: H })
  pushLine(build.folds, xGlue, pad, xGlue, pad + H)
  const placeLid = (cx: number, cy: number, slot: BoxFaceSlot, inner: number) => {
    const outer = inner + skirt
    build.cuts.push(...segsOf(circle(cx, cy, outer, 48)))
    build.folds.push(...segsOf(circle(cx, cy, inner, 40)))
    for (let step = 0; step < 18; step += 1) {
      const angle = (step / 18) * Math.PI * 2
      pushLine(
        build.cuts,
        cx + Math.cos(angle) * inner,
        cy + Math.sin(angle) * inner,
        cx + Math.cos(angle) * outer,
        cy + Math.sin(angle) * outer
      )
    }
    build.panels.push(panel(structure, slot, cx - inner, cy - inner, inner * 2, inner * 2))
  }
  const span = Math.max(topInner, bottomInner) + skirt
  const cx = xGlue + glue + gap + span
  placeLid(cx, pad + span, 'top', topInner)
  placeLid(cx + span * 2 + gap, pad + span, 'bottom', bottomInner)
  build.widthMm = cx + span * 4 + gap + pad
  build.heightMm = Math.max(H, span * 2) + pad * 2
  build.legend.push(
    `Ống Ø ${r3(diameter)} mm, chu vi ${r3(circ)} mm. Nắp ngoài lớn hơn đáy trong. Vành ${skirt} mm có rãnh dán.`
  )
  return build
}

function buildInsert(d: BoxDimensions, resolved: Resolved): Build {
  const cols = resolved.params.insertCols
  const rows = resolved.params.insertRows
  const wall = Math.min(45, Math.max(16, Math.min(d.heightMm * 0.55, 40)))
  const pitchX = d.lengthMm / cols
  const pitchY = d.widthMm / rows
  const jar =
    resolved.params.jarDiameterMm > 0
      ? resolved.params.jarDiameterMm
      : Math.max(18, Math.min(pitchX, pitchY) * 0.72)
  const slotW = Math.max(0.6, resolved.params.paperThicknessMm + 0.25)
  const pad = 4
  const gap = 8
  const build = emptyBuild(0, 0)
  let x = pad
  let y = pad
  let maxX = pad
  const addStrip = (length: number, crosses: number, pitch: number) => {
    const strip: Rect = { x, y, w: length, h: wall }
    build.cuts.push(
      ...segsOf([
        { x, y },
        { x: x + length, y },
        { x: x + length, y: y + wall },
        { x, y: y + wall },
        { x, y },
      ])
    )
    for (let i = 1; i <= crosses; i += 1) {
      const sx = x + pitch * i - slotW / 2
      const sy = y + wall / 2
      pushLine(build.cuts, sx, sy, sx + slotW, sy)
      pushLine(build.cuts, sx, sy, sx, y + wall)
      pushLine(build.cuts, sx + slotW, sy, sx + slotW, y + wall)
    }
    x += length + gap
    maxX = Math.max(maxX, x)
    return strip
  }
  if (rows > 1) {
    for (let i = 0; i < rows - 1; i += 1) addStrip(d.lengthMm - 1, cols - 1, pitchX)
  }
  x = pad
  y += wall + gap
  if (cols > 1) {
    for (let i = 0; i < cols - 1; i += 1) {
      const length = d.widthMm - 1
      build.cuts.push(
        ...segsOf([
          { x, y },
          { x: x + length, y },
          { x: x + length, y: y + wall },
          { x, y: y + wall },
          { x, y },
        ])
      )
      for (let k = 1; k <= rows - 1; k += 1) {
        const sx = x + pitchY * k - slotW / 2
        const sy = y
        pushLine(build.cuts, sx, sy, sx, sy + wall / 2)
        pushLine(build.cuts, sx + slotW, sy, sx + slotW, sy + wall / 2)
        pushLine(build.cuts, sx, sy + wall / 2, sx + slotW, sy + wall / 2)
      }
      x += length + gap
      maxX = Math.max(maxX, x)
    }
  }
  build.widthMm = Math.max(maxX, pad + d.lengthMm) + pad
  build.heightMm = y + (cols > 1 ? wall : 0) + pad
  build.legend.push(
    `Lót ${cols}×${rows} ô, hũ Ø ${r3(jar)} mm, vách cao ${r3(wall)} mm.`,
    'Rãnh lồng sâu một nửa vách. Xoay các dải còn lại 90° khi lắp.'
  )
  return build
}

function addWindow(build: Build) {
  const front = build.panels.find((item) => item.slot === 'front')
  if (!front) return
  const left = build.glueTabMm + 3
  const marginY = Math.max(8, front.h * 0.16)
  const width = front.w - left - 3
  const height = front.h - marginY * 2
  if (width < 6 || height < 6) {
    build.legend.push('Mặt trước không đủ chỗ cho cửa sổ sau tai dán.')
    return
  }
  const rect = {
    x: front.x + left,
    y: front.y + marginY,
    w: width,
    h: height,
  }
  build.cuts.push(...segsOf(roundedRect(rect, 3)))
  build.knockouts.push({ ...rect, kind: 'window', shape: 'rect' })
  build.legend.push('Cửa sổ mặt trước: bế thủng và dán film trong sau khi in.')
}

function addHandle(build: Build) {
  const top = build.panels.find((item) => item.slot === 'top')
  if (!top || build.tuckTabMm < 8) {
    build.legend.push('Hộp quá hẹp nên chưa có quai xách.')
    return
  }
  const handleW = Math.min(top.w * 0.7, top.w - 8)
  const handleH = Math.min(22, Math.max(12, build.tuckTabMm))
  if (handleW < 16) {
    build.legend.push('Hộp quá hẹp nên chưa có quai xách.')
    return
  }
  const x0 = top.x + (top.w - handleW) / 2
  const x1 = x0 + handleW
  const yFold = top.y - build.tuckTabMm
  const next: Seg[] = []
  let found = false
  for (const seg of build.cuts) {
    const horizontal = Math.abs(seg[1] - yFold) < 0.25 && Math.abs(seg[3] - yFold) < 0.25
    const a = Math.min(seg[0], seg[2])
    const b = Math.max(seg[0], seg[2])
    if (!horizontal || b <= x0 + 0.2 || a >= x1 - 0.2) {
      next.push(seg)
      continue
    }
    found = true
    if (a < x0 - 0.2) next.push([r3(a), r3(yFold), r3(x0), r3(yFold)])
    if (b > x1 + 0.2) next.push([r3(x1), r3(yFold), r3(b), r3(yFold)])
  }
  if (!found) {
    build.legend.push('Hộp quá hẹp nên chưa có quai xách.')
    return
  }
  build.cuts.length = 0
  build.cuts.push(...next)
  const yTip = yFold - handleH
  build.cuts.push(
    ...segsOf([
      { x: x0, y: yFold },
      { x: x0, y: yTip },
      { x: x1, y: yTip },
      { x: x1, y: yFold },
    ])
  )
  pushLine(build.folds, x0, yFold, x1, yFold)
  const holeW = handleW * 0.5
  const holeH = Math.min(10, handleH - 8)
  if (holeH >= 6) {
    const hole = { x: x0 + (handleW - holeW) / 2, y: yTip + 4, w: holeW, h: holeH }
    build.cuts.push(...segsOf(roundedRect(hole, 4)))
    build.knockouts.push({ ...hole, kind: 'handle', shape: 'ellipse' })
  }
  build.legend.push('Quai xách liền mép lưỡi nắp.')
}

function addNeck(build: Build) {
  const top = build.panels.find((item) => item.slot === 'top')
  if (!top) return
  const d = Math.min(top.w, top.h) * 0.34
  const rect = { x: top.x + (top.w - d) / 2, y: top.y + (top.h - d) / 2, w: d, h: d }
  build.cuts.push(...segsOf(circle(rect.x + d / 2, rect.y + d / 2, d / 2, 28)))
  build.knockouts.push({ ...rect, kind: 'neck', shape: 'ellipse' })
  build.legend.push('Lỗ cổ chai trên nắp. Không in trong lỗ.')
}

function withExtras(structure: BoxDielineStructure, build: Build): Build {
  if (structure === 'window') addWindow(build)
  if (structure === 'handle') addHandle(build)
  if (structure === 'bottle') addNeck(build)
  return build
}

export function buildDielineLayout(
  structure: BoxDielineStructure,
  d: BoxDimensions,
  production?: Partial<TuckBoxProductionParams>
): TuckEndLayoutData {
  const resolved = resolveProduction(d.heightMm, production)
  if (structure === 'cross_fold') {
    throw new Error('cross_fold is built in box-net-svg')
  }
  let build: Build
  if (structure === 'straight_tuck') build = buildTuckFamily(structure, d, resolved, 'straight', 'tuck')
  else if (structure === 'crash_lock') build = buildTuckFamily(structure, d, resolved, 'crash', 'tuck')
  else if (structure === 'snap_lock') build = buildTuckFamily(structure, d, resolved, 'snap', 'tuck')
  else if (structure === 'window' || structure === 'handle' || structure === 'bottle' || structure === 'reverse_tuck') {
    build = withExtras(structure, buildTuckFamily(structure, d, resolved, 'reverse', 'tuck'))
  } else if (structure === 'telescope') build = buildTelescope(structure, d, resolved)
  else if (structure === 'magnetic') build = buildMagnetic(structure, d, resolved)
  else if (structure === 'sleeve_tray') build = buildSleeveTray(structure, d, resolved)
  else if (structure === 'tray') build = buildTray(structure, d, resolved)
  else if (structure === 'hexagon') build = buildPrism(structure, d, resolved, 6)
  else if (structure === 'octagon') build = buildPrism(structure, d, resolved, 8)
  else if (structure === 'pillow') build = buildPillow(structure, d, resolved)
  else if (structure === 'tube') build = buildTube(structure, d, resolved)
  else build = buildInsert(d, resolved)
  return finish(structure, build)
}
