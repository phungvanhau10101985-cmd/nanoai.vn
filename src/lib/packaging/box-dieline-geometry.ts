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

type Overlay = Rect & { kind: 'window-film' | 'glue-free' }

type Build = {
  panels: TuckEndLayoutData['panels']
  cuts: Seg[]
  folds: Seg[]
  glueRects: Rect[]
  flaps: Flap[]
  knockouts: NonNullable<TuckEndLayoutData['knockouts']>
  overlays: Overlay[]
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
    { x: x2 - r, y },
    ...arcPoints(x2 - r, y + r, r, -Math.PI / 2, 0, 6),
    { x: x2, y: y2 - r },
    ...arcPoints(x2 - r, y2 - r, r, 0, Math.PI / 2, 6),
    { x: x + r, y: y2 },
    ...arcPoints(x + r, y2 - r, r, Math.PI / 2, Math.PI, 6),
    { x, y: y + r },
    ...arcPoints(x + r, y + r, r, Math.PI, (Math.PI * 3) / 2, 6),
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
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const see = (x: number, y: number) => {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  for (const seg of build.cuts) {
    see(seg[0], seg[1])
    see(seg[2], seg[3])
  }
  if (!Number.isFinite(minX)) return
  const dx = -minX
  const dy = -minY
  const moveSeg = (seg: Seg): Seg => [r3(seg[0] + dx), r3(seg[1] + dy), r3(seg[2] + dx), r3(seg[3] + dy)]
  build.cuts = build.cuts.map(moveSeg)
  build.folds = build.folds.map(moveSeg)
  const moveRect = <T extends Rect>(rect: T): T => ({ ...rect, x: r3(rect.x + dx), y: r3(rect.y + dy) })
  build.panels = build.panels.map(moveRect)
  build.glueRects = build.glueRects.map(moveRect)
  build.flaps = build.flaps.map(moveRect)
  build.knockouts = build.knockouts.map(moveRect)
  build.overlays = build.overlays.map(moveRect)
  build.fingerNotches = build.fingerNotches.map((notch) => ({
    ...notch,
    cx: r3(notch.cx + dx),
    cy: r3(notch.cy + dy),
  }))
  build.widthMm = r3(maxX - minX)
  build.heightMm = r3(maxY - minY)
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
    overlays: build.overlays,
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
    overlays: [],
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
  const radius = Math.min(6, Math.max(4, span * 0.22))
  if (!enabled || span < radius * 2 + 4) {
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
    `Tai dán ${glue} mm chồng lên mặt ${W} mm. Mặt đó giữ đủ bề rộng, không trừ độ dày giấy.`
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
  const inset = 0.5
  const hook = Math.min(4.2, box.W * 0.16)
  const openGap = (x: number) => pushLine(build.cuts, x - inset, y0, x + inset, y0)
  const hookFlap = (xL: number, xR: number, mirror: boolean, flushL = false, flushR = false) => {
    const a = flushL ? xL : xL + inset
    const b = flushR ? xR : xR - inset
    const nose = mirror ? a : b
    const head = mirror ? a + hook * 2.4 : b - hook * 2.4
    const pts: Pt[] = mirror
      ? [
          { x: a, y: y0 },
          { x: a, y: y0 + depth * 0.2 },
          { x: nose + 0.4, y: y0 + depth * 0.42 },
          { x: head, y: y0 + depth * 0.58 },
          { x: head, y: y1 },
          { x: b - (b - a) * 0.08, y: y1 },
          { x: b, y: y0 + depth * 0.22 },
          { x: b, y: y0 },
        ]
      : [
          { x: a, y: y0 },
          { x: a, y: y0 + depth * 0.22 },
          { x: a + (b - a) * 0.08, y: y1 },
          { x: head, y: y1 },
          { x: head, y: y0 + depth * 0.58 },
          { x: nose - 0.4, y: y0 + depth * 0.42 },
          { x: b, y: y0 + depth * 0.2 },
          { x: b, y: y0 },
        ]
    build.cuts.push(...segsOf(pts))
    pushLine(build.folds, a, y0, b, y0)
  }
  const diagonalFlap = (xL: number, xR: number, mirror: boolean, flushL = false, flushR = false) => {
    const a = flushL ? xL : xL + inset
    const b = flushR ? xR : xR - inset
    const run = Math.min(b - a, depth)
    const knee = mirror ? b - run : a + run
    const pts: Pt[] = mirror
      ? [
          { x: a, y: y0 },
          { x: a, y: y0 + depth * 0.22 },
          { x: knee, y: y1 },
          { x: b, y: y1 },
          { x: b, y: y0 },
        ]
      : [
          { x: a, y: y0 },
          { x: a, y: y1 },
          { x: knee, y: y1 },
          { x: b, y: y0 + depth * 0.22 },
          { x: b, y: y0 },
        ]
    build.cuts.push(...segsOf(pts))
    pushLine(build.folds, a, y0, b, y0)
    pushLine(build.folds, mirror ? b : a, y0, knee, y1)
    const slotW = Math.min(6, (b - a) * 0.28)
    const slotX = mirror ? b - run * 0.55 - slotW : a + run * 0.55
    const slotY = y0 + depth * 0.62
    pushLine(build.cuts, slotX, slotY, slotX + slotW, slotY)
    build.glueRects.push(
      mirror
        ? { x: a, y: y0 + depth * 0.28, w: Math.max(4, (knee - a) * 0.7), h: depth * 0.55 }
        : { x: knee, y: y0 + depth * 0.28, w: Math.max(4, (b - knee) * 0.7), h: depth * 0.55 }
    )
  }
  hookFlap(box.x0, box.x1, false, true, false)
  openGap(box.x1)
  diagonalFlap(box.x1, box.x2, false)
  openGap(box.x2)
  hookFlap(box.x2, box.x3, true)
  openGap(box.x3)
  diagonalFlap(box.x3, box.x4, true, false, true)
  build.legend.push('Đáy khóa tự động: móc ở mặt trước và mặt sau, khe và keo trên hai hông, khe hở 1 mm.')
  return y1
}

function addSnapBottom(
  build: Build,
  box: { x0: number; x1: number; x2: number; x3: number; x4: number; bodyBottom: number; L: number; W: number; lidExtra: number }
): number {
  const y0 = box.bodyBottom
  const inset = 0.5
  const sideDepth = Math.max(10, box.W * 0.42)
  const backDepth = Math.max(sideDepth + 4, box.W * 0.62)
  const tongue = Math.min(14, Math.max(8, box.W * 0.28))
  const frontDepth = Math.max(10, box.W * 0.48)
  const notchRadius = Math.min(7, Math.max(3.5, (box.L - inset * 2) * 0.18))
  const tongueNeck = Math.max(6, notchRadius * 2 - 1.2)
  let reach = y0 + frontDepth + tongue
  const span = (xL: number, xR: number, flushL: boolean, flushR: boolean) => ({
    a: flushL ? xL : xL + inset,
    b: flushR ? xR : xR - inset,
  })
  const sideFlap = (xL: number, xR: number, flushL: boolean, flushR: boolean) => {
    const { a, b } = span(xL, xR, flushL, flushR)
    const taper = Math.min(4, Math.max(1.5, (b - a) * 0.16))
    build.cuts.push(
      ...segsOf([
        { x: a, y: y0 },
        { x: a + taper, y: y0 + sideDepth },
        { x: b - taper, y: y0 + sideDepth },
        { x: b, y: y0 },
      ])
    )
    pushLine(build.folds, a, y0, b, y0)
  }
  const notchFlap = (xL: number, xR: number) => {
    const { a, b } = span(xL, xR, false, false)
    const mid = (a + b) / 2
    const radius = notchRadius
    const yOuter = y0 + backDepth
    build.cuts.push(
      ...segsOf([
        { x: a, y: y0 },
        { x: a, y: yOuter },
        { x: mid - radius, y: yOuter },
        ...arcPoints(mid, yOuter, radius, Math.PI, Math.PI * 2, 8),
        { x: b, y: yOuter },
        { x: b, y: y0 },
      ])
    )
    pushLine(build.folds, a, y0, b, y0)
    reach = Math.max(reach, yOuter)
  }
  const tongueFlap = (xL: number, xR: number) => {
    const { a, b } = span(xL, xR, true, false)
    const mid = (a + b) / 2
    const tongueW = Math.min(tongueNeck, b - a - 4)
    const barb = 0.4
    const yBody = y0 + frontDepth
    const yTip = yBody + tongue
    const half = tongueW / 2
    build.cuts.push(
      ...segsOf([
        { x: a, y: y0 },
        { x: a, y: yBody },
        { x: mid - half, y: yBody },
        { x: mid - half - barb, y: yBody + 3 },
        { x: mid - half, y: yTip },
        { x: mid + half, y: yTip },
        { x: mid + half + barb, y: yBody + 3 },
        { x: mid + half, y: yBody },
        { x: b, y: yBody },
        { x: b, y: y0 },
      ])
    )
    pushLine(build.folds, a, y0, b, y0)
    reach = Math.max(reach, yTip)
  }
  tongueFlap(box.x0, box.x1)
  sideFlap(box.x1, box.x2, false, false)
  notchFlap(box.x2, box.x3)
  sideFlap(box.x3, box.x4, false, true)
  for (const x of [box.x1, box.x2, box.x3]) pushLine(build.cuts, x - inset, y0, x + inset, y0)
  build.legend.push(
    `Đáy 1-2-3: gấp hai hông, gấp mặt sau có khía chữ U Ø ${r3(notchRadius * 2)} mm, lưỡi hẹp hơn miệng khía 1,2 mm. Bốn cánh đan nhau, không keo.`
  )
  return reach
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
  const base = placeTray(build, structure, 2, 2, L, W, baseWall, glue, 'bottom', {
    front: 'front',
    back: 'back',
    left: 'left',
    right: 'right',
  })
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

function placeBoardCross(build: Build, x: number, y: number, length: number, width: number, wall: number) {
  const x0 = x + wall
  const x1 = x0 + length
  const y0 = y
  const y1 = y + wall
  const y2 = y1 + width
  const y3 = y2 + wall
  const xl = x
  const xr = x1 + wall
  build.cuts.push(
    ...segsOf([
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: xr, y: y1 },
      { x: xr, y: y2 },
      { x: x1, y: y2 },
      { x: x1, y: y3 },
      { x: x0, y: y3 },
      { x: x0, y: y2 },
      { x: xl, y: y2 },
      { x: xl, y: y1 },
      { x: x0, y: y1 },
      { x: x0, y: y0 },
    ])
  )
  pushLine(build.folds, x0, y1, x1, y1)
  pushLine(build.folds, x0, y2, x1, y2)
  pushLine(build.folds, x0, y1, x0, y2)
  pushLine(build.folds, x1, y1, x1, y2)
}

function markTurnIn(build: Build, originX: number, originY: number, floorL: number, floorW: number, wallH: number, turn: number) {
  const fx = originX + wallH
  const fy = originY + wallH
  const yBack = originY + turn
  const yFront = fy + floorW + wallH - turn
  const xLeft = originX + turn
  const xRight = fx + floorL + wallH - turn
  pushLine(build.folds, fx, yBack, fx + floorL, yBack)
  pushLine(build.folds, fx, yFront, fx + floorL, yFront)
  pushLine(build.folds, xLeft, fy, xLeft, fy + floorW)
  pushLine(build.folds, xRight, fy, xRight, fy + floorW)
}

function buildMagnetic(structure: BoxDielineStructure, d: BoxDimensions, resolved: Resolved): Build {
  const { lengthMm: L, widthMm: W, heightMm: H } = d
  const board = 1.8
  const turn = 14
  const gap = 18
  const paper = resolved.params.paperThicknessMm
  const build = emptyBuild(turn, 0)
  const baseFloorL = r3(L + 2 * board)
  const baseFloorW = r3(W + 2 * board)
  const baseWall = r3(H + board + turn)
  const lidClear = r3(2 * paper + 1)
  const lidL = r3(baseFloorL + lidClear)
  const lidW = r3(baseFloorW + lidClear)
  const lidWallBoard = Math.max(18, Math.min(28, H * 0.35))
  const lidFloorL = r3(lidL + 2 * board)
  const lidFloorW = r3(lidW + 2 * board)
  const lidWall = r3(lidWallBoard + board + turn)
  const base = placeTray(build, structure, 2, 2, baseFloorL, baseFloorW, baseWall, turn, 'bottom', {
    front: 'front',
    back: 'back',
    left: 'left',
    right: 'right',
  })
  markTurnIn(build, 2, 2, baseFloorL, baseFloorW, baseWall, turn)
  const lidX = 2 + base.width + gap
  const lid = placeTray(build, structure, lidX, 2, lidFloorL, lidFloorW, lidWall, turn, 'top', {
    front: 'front',
    back: 'back',
    left: 'left',
    right: 'right',
  })
  markTurnIn(build, lidX, 2, lidFloorL, lidFloorW, lidWall, turn)
  const markMagnet = (host: (typeof build.panels)[number]) => {
    const w = Math.min(18, host.w * 0.42)
    const h = Math.min(10, Math.max(6, host.h * 0.28))
    build.knockouts.push({
      x: host.x + (host.w - w) / 2,
      y: host.y + host.h - h - 3,
      w,
      h,
      kind: 'magnet',
      shape: 'rect',
    })
  }
  for (const host of build.panels.filter((item) => item.slot === 'front')) markMagnet(host)
  const boardY = 2 + Math.max(base.height, lid.height) + gap
  placeBoardCross(build, 2, boardY, L, W, H)
  placeBoardCross(build, lidX, boardY, lidL, lidW, lidWallBoard)
  build.widthMm = Math.max(lidX + lid.width, lidX + lidFloorL + lidWall * 2) + 4
  build.heightMm = boardY + Math.max(W + H * 2, lidW + lidWallBoard * 2) + 4
  build.legend.push(
    `Nắp chụp cứng, không bản lề. Lõi ${board} mm rạch V theo nếp: đáy ${L}×${W}×${H}, nắp lòng ${lidL}×${lidW}.`,
    `Giấy bọc lớn hơn lõi: đáy ${baseFloorL}×${baseFloorW}, thành ${baseWall} mm = ${H} + lõi + turn-in ${turn}. Nếp turn-in cách mép ${turn} mm.`,
    'Vùng nam châm để trống mực trên thành trước. Không bế thủng.'
  )
  return build
}

function buildSleeveTray(structure: BoxDielineStructure, d: BoxDimensions, resolved: Resolved): Build {
  const glue = resolved.params.glueTabMm
  const pad = 2
  const t = resolved.params.paperThicknessMm
  const c = Math.max(0.6, resolved.params.compensationGapMm || 0.8)
  const sorted = [d.lengthMm, d.widthMm, d.heightMm].sort((a, b) => b - a)
  const slide = sorted[0]!
  const floorW = sorted[1]!
  const wall = sorted[2]!
  const trayLen = slide
  const trayWid = floorW
  const trayWall = wall
  const sleeveLen = r3(slide + c)
  const acrossW = r3(trayWid + 2 * t + c)
  const acrossH = r3(trayWall + t + c)
  const build = emptyBuild(glue, 0)
  const x0 = pad
  const bodyTop = pad
  const spans = [acrossW, acrossH, acrossW, acrossH]
  const slots: Array<'front' | 'right' | 'back' | 'left'> = ['front', 'right', 'back', 'left']
  let xCursor = x0
  for (let i = 0; i < spans.length; i += 1) {
    const span = spans[i]!
    build.panels.push(panel(structure, slots[i]!, xCursor, bodyTop, span, sleeveLen))
    if (i > 0) pushLine(build.folds, xCursor, bodyTop, xCursor, bodyTop + sleeveLen)
    xCursor += span
  }
  const xEnd = xCursor
  pushLine(build.folds, xEnd, bodyTop, xEnd, bodyTop + sleeveLen)
  const inset = Math.min(4, sleeveLen * 0.08)
  build.cuts.push(
    ...segsOf([
      { x: xEnd, y: bodyTop },
      { x: xEnd + glue, y: bodyTop + inset },
      { x: xEnd + glue, y: bodyTop + sleeveLen - inset },
      { x: xEnd, y: bodyTop + sleeveLen },
    ])
  )
  build.glueRects.push({ x: xEnd, y: bodyTop, w: glue, h: sleeveLen })
  pushLine(build.cuts, x0, bodyTop, x0, bodyTop + sleeveLen)
  const notchR = Math.min(8, acrossW * 0.28)
  const nx = x0 + acrossW / 2
  if (notchR >= 3.2 && acrossW > notchR * 2 + 4) {
    build.cuts.push(
      ...segsOf([{ x: x0, y: bodyTop }, ...arcPoints(nx, bodyTop, notchR, Math.PI, 0, 8), { x: x0 + acrossW, y: bodyTop }])
    )
    build.fingerNotches.push({ cx: nx, cy: bodyTop, r: notchR, slot: 'front', edge: 'top' })
  } else {
    pushLine(build.cuts, x0, bodyTop, x0 + acrossW, bodyTop)
  }
  pushLine(build.cuts, x0 + acrossW, bodyTop, xEnd, bodyTop)
  pushLine(build.cuts, x0, bodyTop + sleeveLen, xEnd, bodyTop + sleeveLen)
  const trayX = xEnd + glue + 12
  placeTray(build, structure, trayX, pad, trayLen, trayWid, trayWall, Math.min(glue, 14), 'bottom', {})
  build.widthMm = trayX + trayLen + trayWall * 2 + pad
  build.heightMm = Math.max(sleeveLen, trayWid + trayWall * 2) + pad * 2
  build.legend.push(
    `Khay lòng ${r3(trayLen)}×${r3(trayWid)}×${r3(trayWall)} mm bằng sản phẩm.`,
    `Ống lòng ${acrossW}×${acrossH}×${sleeveLen} mm = khay + 2t + khe.`
  )
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
      pushLine(build.folds, left.x, left.y, right.x, right.y)
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
    build.panels.push(panel(structure, slot, x, bodyTop, sideW, H))
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
  build.legend.push(`${sides} cạnh, mỗi cạnh ${r3(sideW)} mm. Tai dán ${r3(glue)} mm. Nắp đa giác có nếp lưỡi.`)
  return build
}

function buildPillow(structure: BoxDielineStructure, d: BoxDimensions, resolved: Resolved): Build {
  const sorted = [d.lengthMm, d.widthMm, d.heightMm].sort((a, b) => b - a)
  const axis = sorted[0]!
  const secA = sorted[1]!
  const secB = sorted[2]!
  const glue = Math.min(15, Math.max(12, resolved.params.glueTabMm))
  const endDepth = ((secA + secB) / 2) * 0.5
  const half = secA + secB
  const girth = half * 2
  const totalLen = axis + endDepth * 2
  const build = emptyBuild(glue, 0)
  const y0 = 0
  const midY = half
  const yGlue = girth
  const curve = (from: Pt, tip: Pt, to: Pt) => {
    const pts: Pt[] = []
    for (let i = 0; i <= 12; i += 1) {
      const t = i / 12
      const u = 1 - t
      pts.push({
        x: u * u * from.x + 2 * u * t * tip.x + t * t * to.x,
        y: u * u * from.y + 2 * u * t * tip.y + t * t * to.y,
      })
    }
    return pts
  }
  const leftOuter = curve({ x: endDepth, y: y0 }, { x: -endDepth, y: midY }, { x: endDepth, y: yGlue })
  const rightOuter = curve(
    { x: totalLen - endDepth, y: y0 },
    { x: totalLen + endDepth, y: midY },
    { x: totalLen - endDepth, y: yGlue }
  )
  const creaseInset = endDepth * 0.42
  const leftCrease = curve({ x: endDepth, y: y0 }, { x: creaseInset, y: midY }, { x: endDepth, y: yGlue })
  const rightCrease = curve(
    { x: totalLen - endDepth, y: y0 },
    { x: totalLen - creaseInset, y: midY },
    { x: totalLen - endDepth, y: yGlue }
  )
  const leftReturn = [...leftOuter].reverse()
  build.cuts.push(
    ...segsOf([
      { x: endDepth, y: y0 },
      { x: totalLen - endDepth, y: y0 },
      ...rightOuter.slice(1),
      { x: totalLen - endDepth, y: yGlue + glue },
      { x: endDepth, y: yGlue + glue },
      { x: endDepth, y: yGlue },
      ...leftReturn.slice(1),
    ])
  )
  build.folds.push(...segsOf(leftCrease), ...segsOf(rightCrease))
  pushLine(build.folds, 0, midY, totalLen, midY)
  pushLine(build.folds, endDepth, yGlue, totalLen - endDepth, yGlue)
  build.glueRects.push({ x: endDepth, y: yGlue, w: axis, h: glue })
  build.panels.push(
    { ...panel(structure, 'front', endDepth, y0, axis, half), fit: 'cover' },
    { ...panel(structure, 'back', endDepth, midY, axis, half), fit: 'cover' }
  )
  build.widthMm = totalLen
  build.heightMm = yGlue + glue
  build.legend.push(
    `Hộp gối trục ${r3(axis)} mm, chu vi ${r3(girth)} mm + tai dán ${r3(glue)} mm.`,
    'Hai đầu là cung cắt, nếp cong nằm trong, nếp giữa chạy hết mép cắt.'
  )
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
  const tubeSlots: Array<'front' | 'right' | 'back' | 'left'> = ['front', 'right', 'back', 'left']
  const tubeSpan = circ / tubeSlots.length
  for (let i = 0; i < tubeSlots.length; i += 1) {
    build.panels.push(panel(structure, tubeSlots[i]!, pad + tubeSpan * i, pad, tubeSpan, H))
  }
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
    const count = 18
    const mouth = (skirt * 2 * Math.PI) / count
    const half = mouth / 2 / outer
    const boundary: Pt[] = []
    for (let step = 0; step < count; step += 1) {
      const tip = ((step + 1) / count) * Math.PI * 2
      const from = tip - (Math.PI * 2) / count + half
      const to = tip - half
      boundary.push(...arcPoints(cx, cy, outer, from, to, 3))
      boundary.push({ x: cx + Math.cos(tip) * inner, y: cy + Math.sin(tip) * inner })
    }
    boundary.push(boundary[0]!)
    build.cuts.push(...segsOf(boundary))
    build.folds.push(...segsOf(circle(cx, cy, inner, 40)))
    const artR = Math.max(4, inner - 1.2)
    build.panels.push(panel(structure, slot, cx - artR, cy - artR, artR * 2, artR * 2))
    for (let step = 0; step < count; step += 1) {
      const tip = ((step + 0.5) / count) * Math.PI * 2
      const gx = cx + Math.cos(tip) * (inner + skirt * 0.55)
      const gy = cy + Math.sin(tip) * (inner + skirt * 0.55)
      const size = 3
      build.glueRects.push({ x: gx - size / 2, y: gy - size / 2, w: size, h: size })
    }
  }
  const span = Math.max(topInner, bottomInner) + skirt
  const cx = xGlue + glue + gap + span
  placeLid(cx, pad + span, 'top', topInner)
  placeLid(cx + span * 2 + gap, pad + span, 'bottom', bottomInner)
  build.widthMm = cx + span * 4 + gap + pad
  build.heightMm = Math.max(H, span * 2) + pad * 2
  build.legend.push(
    `Ống Ø ${r3(diameter)} mm, chu vi ${r3(circ)} mm. Art đĩa nằm trong nếp 1,2 mm. Vành ${skirt} mm có keo trên từng tab.`
  )
  return build
}

function buildInsert(d: BoxDimensions, resolved: Resolved): Build {
  const cols = resolved.params.insertCols
  const rows = resolved.params.insertRows
  const wall = Math.min(45, Math.max(16, Math.min(d.heightMm * 0.55, 40)))
  const lengthA = Math.max(8, d.lengthMm - 1)
  const lengthB = Math.max(8, d.widthMm - 1)
  const pitchA = cols > 1 ? lengthA / cols : lengthA
  const pitchB = rows > 1 ? lengthB / rows : lengthB
  const slotW = Math.max(0.6, resolved.params.paperThicknessMm + 0.25)
  const cell = Math.min(pitchA, pitchB) - slotW
  const fits = Math.max(0, r3(cell - 1))
  const requested = resolved.params.jarDiameterMm
  if (fits < 12 && Math.min(d.lengthMm, d.widthMm) >= 24) {
    const plate = r3(Math.min(d.lengthMm, d.widthMm) - 1)
    const hole = r3(Math.max(8, Math.min(plate - 8, plate * 0.72)))
    const foot = 12
    const footW = r3(Math.max(10, plate - 8))
    const pad = 4
    const build = emptyBuild(0, 0)
    const x = pad
    const y = pad + foot
    const footX = x + (plate - footW) / 2
    build.cuts.push(
      ...segsOf([
        { x: footX, y: pad },
        { x: footX + footW, y: pad },
        { x: footX + footW, y },
        { x: x + plate, y },
        { x: x + plate, y: y + plate },
        { x: footX + footW, y: y + plate },
        { x: footX + footW, y: y + plate + foot },
        { x: footX, y: y + plate + foot },
        { x: footX, y: y + plate },
        { x, y: y + plate },
        { x, y },
        { x: footX, y },
        { x: footX, y: pad },
      ])
    )
    pushLine(build.folds, footX, y, footX + footW, y)
    pushLine(build.folds, footX, y + plate, footX + footW, y + plate)
    const radius = hole / 2
    build.cuts.push(...segsOf(circle(x + plate / 2, y + plate / 2, radius, 32)))
    build.knockouts.push({
      x: x + plate / 2 - radius,
      y: y + plate / 2 - radius,
      w: hole,
      h: hole,
      kind: 'neck',
      shape: 'ellipse',
    })
    build.widthMm = plate + pad * 2
    build.heightMm = plate + foot * 2 + pad * 2
    build.legend.push(
      `Tấm chèn ${plate}×${plate} mm, nhỏ hơn lòng hộp 1 mm, lỗ Ø ${hole} mm, hai chân ${foot} mm. Lưới ${cols}×${rows} chỉ còn ô Ø ${r3(fits)} mm nên không giữ được lọ này.`
    )
    return build
  }
  const pad = 4
  const gap = 8
  const build = emptyBuild(0, 0)
  let x = pad
  let y = pad
  let maxX = pad
  const addStrip = (length: number, crosses: number) => {
    const pitch = length / (crosses + 1)
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
  }
  if (rows > 1) {
    for (let i = 0; i < rows - 1; i += 1) addStrip(lengthA, cols - 1)
  }
  x = pad
  y += wall + gap
  if (cols > 1) {
    for (let i = 0; i < cols - 1; i += 1) {
      const pitch = lengthB / rows
      build.cuts.push(
        ...segsOf([
          { x, y },
          { x: x + lengthB, y },
          { x: x + lengthB, y: y + wall },
          { x, y: y + wall },
          { x, y },
        ])
      )
      for (let k = 1; k <= rows - 1; k += 1) {
        const sx = x + pitch * k - slotW / 2
        const sy = y
        pushLine(build.cuts, sx, sy, sx, sy + wall / 2)
        pushLine(build.cuts, sx + slotW, sy, sx + slotW, sy + wall / 2)
        pushLine(build.cuts, sx, sy + wall / 2, sx + slotW, sy + wall / 2)
      }
      x += lengthB + gap
      maxX = Math.max(maxX, x)
    }
  }
  build.widthMm = Math.max(maxX, pad + lengthA) + pad
  build.heightMm = y + (cols > 1 ? wall : 0) + pad
  const jarNote =
    requested > 0 && requested > fits + 0.05
      ? `Ô khoảng ${r3(cell)} mm không chứa hũ Ø ${r3(requested)} mm. Vừa tối đa Ø ${fits} mm.`
      : `Ô vừa hũ tới Ø ${requested > 0 ? r3(requested) : fits} mm.`
  build.legend.push(`Lót ${cols}×${rows}, dải ${r3(lengthA)}×${r3(lengthB)} mm, vách ${r3(wall)} mm.`, jarNote)
  return build
}

function addWindow(build: Build) {
  const front = build.panels.find((item) => item.slot === 'front')
  const side = build.panels.find((item) => item.slot === 'right')
  if (!front) return
  const glueClear = build.glueTabMm + 3
  const frontFree = front.w - glueClear - 4
  const host = frontFree >= 18 || !side ? front : side
  const onFront = host === front
  const marginX = Math.max(6, onFront ? glueClear : 6)
  const topReserve = Math.max(26, host.h * 0.28)
  const bottomReserve = Math.max(22, host.h * 0.22)
  const width = host.w - marginX * 2
  const height = host.h - topReserve - bottomReserve
  if (width < 8 || height < 12) {
    build.legend.push('Không đủ chỗ cho cửa sổ sau khi chừa tai dán và ô lô/logo.')
    return
  }
  const rect = {
    x: host.x + marginX,
    y: host.y + topReserve,
    w: width,
    h: height,
  }
  build.cuts.push(...segsOf(roundedRect(rect, 3)))
  build.knockouts.push({ ...rect, kind: 'window', shape: 'rect' })
  const filmGap = 2
  const filmOut = 3
  const film = {
    x: Math.max(host.x + filmGap, rect.x - filmOut),
    y: Math.max(host.y + filmGap, rect.y - filmOut),
    w: Math.min(host.x + host.w - filmGap, rect.x + rect.w + filmOut) - Math.max(host.x + filmGap, rect.x - filmOut),
    h: Math.min(host.y + host.h - filmGap, rect.y + rect.h + filmOut) - Math.max(host.y + filmGap, rect.y - filmOut),
  }
  build.overlays.push({ ...film, kind: 'window-film' }, { ...film, kind: 'glue-free' })
  const insetX = r3(film.x - host.x)
  build.legend.push(
    onFront
      ? `Cửa sổ mặt trước. Film cách nếp ${insetX} mm, không chạm nếp, không keo.`
      : `Cửa sổ ở hông phải, chừa ${r3(topReserve)} mm trên và ${r3(bottomReserve)} mm dưới cho logo và ô lô. Film cách nếp ${insetX} mm.`
  )
}

function addHandle(build: Build) {
  const back = build.panels.find((item) => item.slot === 'back')
  if (!back) {
    build.legend.push('Không có mặt sau để gắn quai.')
    return
  }
  const holeW = 25
  const holeH = 15
  const margin = 4
  const handleW = Math.min(back.w - 2, Math.max(holeW + margin * 2, 33))
  const handleH = holeH + margin * 2
  if (handleW < holeW + 6) {
    build.legend.push('Mặt sau hẹp hơn lỗ quai 25×15 mm. Hộp này không phù hợp để xách.')
    return
  }
  const x0 = back.x + (back.w - handleW) / 2
  const x1 = x0 + handleW
  const yFold = back.y
  const band = 8
  build.cuts = build.cuts.filter((seg) => {
    const within = (x: number, y: number) =>
      x >= back.x - 0.4 && x <= back.x + back.w + 0.4 && y >= yFold - 0.4 && y <= yFold + band
    return !(within(seg[0], seg[1]) && within(seg[2], seg[3]))
  })
  build.fingerNotches = build.fingerNotches.filter((notch) => notch.slot !== 'back')
  pushLine(build.cuts, back.x, yFold, x0, yFold)
  pushLine(build.cuts, x1, yFold, back.x + back.w, yFold)
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
  const hole = {
    x: x0 + (handleW - holeW) / 2,
    y: yTip + margin,
    w: holeW,
    h: holeH,
  }
  build.cuts.push(...segsOf(roundedRect(hole, 4)))
  build.knockouts.push({ ...hole, kind: 'handle', shape: 'ellipse' })
  const narrow = Math.min(back.w, back.h) < 60
  build.legend.push(
    narrow
      ? 'Quai liền mặt sau, lỗ 25×15 mm. Hộp dưới 60 mm nên quai không thoải mái khi xách.'
      : 'Quai liền mặt sau, lỗ 25×15 mm. Quai đứng lên khỏi miệng hộp, không đi theo lưỡi gài.'
  )
}

function addNeck(build: Build, requestedMm: number) {
  const top = build.panels.find((item) => item.slot === 'top')
  const front = build.panels.find((item) => item.slot === 'front')
  const side = build.panels.find((item) => item.slot === 'right')
  if (!top || !front || !side) return
  const y0 = front.y + front.h
  const gap = 1.2
  const xL = front.x + gap
  const xR = front.x + front.w - gap
  build.cuts = build.cuts.filter((seg) => {
    const horizontal = Math.abs(seg[1] - y0) < 0.2 && Math.abs(seg[3] - y0) < 0.2
    const onFront =
      Math.min(seg[0], seg[2]) >= front.x - 0.3 && Math.max(seg[0], seg[2]) <= front.x + front.w + 0.3
    return !(horizontal && onFront)
  })
  pushLine(build.cuts, front.x, y0, xL, y0)
  pushLine(build.cuts, xR, y0, front.x + front.w, y0)
  const neckHeight =
    requestedMm > 0 ? Math.min(front.h * 0.42, Math.max(14, requestedMm * 1.6)) : front.h * 0.28
  const foot = Math.max(12, r3(front.h - neckHeight))
  const platD = Math.max(requestedMm + 8, side.w - 2)
  const yPlat = y0 + foot
  const yReturn = yPlat + platD
  const yEnd = yReturn + foot
  build.cuts.push(
    ...segsOf([
      { x: xL, y: y0 },
      { x: xL, y: yEnd },
      { x: xR, y: yEnd },
      { x: xR, y: y0 },
    ])
  )
  pushLine(build.folds, xL, y0, xR, y0)
  pushLine(build.folds, xL, yPlat, xR, yPlat)
  pushLine(build.folds, xL, yReturn, xR, yReturn)
  if (requestedMm > 0) {
    const hole = Math.min(requestedMm, platD - 4, xR - xL - 4)
    const cx = (xL + xR) / 2
    const cy = yPlat + platD / 2
    build.cuts.push(...segsOf(circle(cx, cy, hole / 2, 28)))
    build.knockouts.push({
      x: cx - hole / 2,
      y: cy - hole / 2,
      w: hole,
      h: hole,
      kind: 'neck',
      shape: 'ellipse',
    })
    const lidHole = Math.min(hole, top.h * 0.42, top.w - 8)
    const lidCx = top.x + top.w / 2
    const lidCy = top.y + lidHole / 2 + 3
    build.cuts.push(...segsOf(circle(lidCx, lidCy, lidHole / 2, 28)))
    build.knockouts.push({
      x: lidCx - lidHole / 2,
      y: lidCy - lidHole / 2,
      w: lidHole,
      h: lidHole,
      kind: 'neck',
      shape: 'ellipse',
    })
    build.legend.push(
      `Tấm đỡ gấp chữ П liền đáy trước, chân ${r3(foot)} mm = H − chiều cao cổ. Lỗ Ø ${r3(hole)} mm trên tấm đỡ và sát mép lưỡi nắp.`
    )
    return
  }
  build.legend.push(
    `Chưa nhập Ø nắp chai nên chưa khoét lỗ. Tấm đỡ gấp chữ П liền đáy trước, chân ${r3(foot)} mm.`
  )
}

function withExtras(structure: BoxDielineStructure, build: Build, resolved: Resolved): Build {
  if (structure === 'window') addWindow(build)
  if (structure === 'handle') addHandle(build)
  if (structure === 'bottle') addNeck(build, resolved.params.neckDiameterMm)
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
    build = withExtras(structure, buildTuckFamily(structure, d, resolved, 'reverse', 'tuck'), resolved)
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
