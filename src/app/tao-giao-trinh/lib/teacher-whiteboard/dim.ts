import { dist, pointToSegment, whiteboardChromeScale, worldToScreen } from './geometry'
import { formatGridMeasure, formatLineAngle } from './line-measure'
import { straightSegments } from './triangle-line'
import type { WhiteboardCamera, WhiteboardDim, WhiteboardDimKind, WhiteboardDimTool, WhiteboardObject, WhiteboardPoint } from './types'

export type DimChain = {
  mode: 'linear' | 'aligned'
  baseP1: WhiteboardPoint
  p2: WhiteboardPoint
  place: WhiteboardPoint
  basePlace: WhiteboardPoint
  stack: number
}

export type ComposedDim = {
  dim: WhiteboardDimKind
  points: WhiteboardPoint[]
  chain: DimChain | null
}

function far(a: WhiteboardPoint, b: WhiteboardPoint): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) >= 1
}

export function linearIsHorizontal(p1: WhiteboardPoint, p2: WhiteboardPoint, place: WhiteboardPoint): boolean {
  const midX = (p1.x + p2.x) / 2
  const midY = (p1.y + p2.y) / 2
  return Math.abs(place.y - midY) >= Math.abs(place.x - midX)
}

function sidePlace(p1: WhiteboardPoint, p2: WhiteboardPoint, gap: number): WhiteboardPoint {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const len = Math.hypot(dx, dy) || 1
  return {
    x: (p1.x + p2.x) / 2 + (-dy / len) * gap,
    y: (p1.y + p2.y) / 2 + (dx / len) * gap,
  }
}

function signedOffset(p1: WhiteboardPoint, p2: WhiteboardPoint, place: WhiteboardPoint): number {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  return (place.x - p1.x) * nx + (place.y - p1.y) * ny
}

function placeOnOffset(p1: WhiteboardPoint, p2: WhiteboardPoint, offset: number): WhiteboardPoint {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const len = Math.hypot(dx, dy) || 1
  return {
    x: (p1.x + p2.x) / 2 + (-dy / len) * offset,
    y: (p1.y + p2.y) / 2 + (dx / len) * offset,
  }
}

function chainOf(mode: 'linear' | 'aligned', p1: WhiteboardPoint, p2: WhiteboardPoint, place: WhiteboardPoint): DimChain {
  return { mode, baseP1: p1, p2, place, basePlace: place, stack: 0 }
}

export function dimClicksNeeded(tool: WhiteboardDimTool, chain: DimChain | null): number {
  if ((tool === 'continue' || tool === 'baseline') && chain) return 1
  if (tool === 'quick' || tool === 'radius' || tool === 'diameter' || tool === 'ordinate') return 2
  return 3
}

function sweepOf(vertex: WhiteboardPoint, a: WhiteboardPoint, b: WhiteboardPoint): number {
  const a1 = Math.atan2(a.y - vertex.y, a.x - vertex.x)
  const a2 = Math.atan2(b.y - vertex.y, b.x - vertex.x)
  let sweep = a2 - a1
  while (sweep > Math.PI) sweep -= Math.PI * 2
  while (sweep < -Math.PI) sweep += Math.PI * 2
  return sweep
}

export function composeDim(tool: WhiteboardDimTool, picks: WhiteboardPoint[], chain: DimChain | null): ComposedDim | null {
  const need = dimClicksNeeded(tool, chain)
  if (picks.length < need) return null
  const pts = picks.slice(0, need)

  if (tool === 'quick') {
    if (!far(pts[0], pts[1])) return null
    const place = sidePlace(pts[0], pts[1], 36)
    return { dim: 'aligned', points: [pts[0], pts[1], place], chain: chainOf('aligned', pts[0], pts[1], place) }
  }
  if (tool === 'linear' || ((tool === 'continue' || tool === 'baseline') && !chain)) {
    if (!far(pts[0], pts[1])) return null
    return { dim: 'linear', points: pts, chain: chainOf('linear', pts[0], pts[1], pts[2]) }
  }
  if (tool === 'aligned') {
    if (!far(pts[0], pts[1])) return null
    return { dim: 'aligned', points: pts, chain: chainOf('aligned', pts[0], pts[1], pts[2]) }
  }
  if (tool === 'continue' && chain) {
    const next = pts[0]
    if (chain.mode === 'linear') {
      if (!far(chain.p2, next)) return null
      const horizontal = linearIsHorizontal(chain.baseP1, chain.p2, chain.place)
      const place = horizontal
        ? { x: (chain.p2.x + next.x) / 2, y: chain.place.y }
        : { x: chain.place.x, y: (chain.p2.y + next.y) / 2 }
      return { dim: 'linear', points: [chain.p2, next, place], chain: { ...chain, p2: next, place } }
    }
    if (!far(chain.p2, next)) return null
    const place = placeOnOffset(chain.p2, next, signedOffset(chain.baseP1, chain.p2, chain.place))
    return { dim: 'aligned', points: [chain.p2, next, place], chain: { ...chain, mode: 'aligned', p2: next, place } }
  }
  if (tool === 'baseline' && chain) {
    const next = pts[0]
    const stack = chain.stack + 1
    if (chain.mode === 'linear') {
      if (!far(chain.baseP1, next)) return null
      const horizontal = linearIsHorizontal(chain.baseP1, chain.p2, chain.basePlace)
      const midX = (chain.baseP1.x + chain.p2.x) / 2
      const midY = (chain.baseP1.y + chain.p2.y) / 2
      const sign = horizontal ? (chain.basePlace.y >= midY ? 1 : -1) : (chain.basePlace.x >= midX ? 1 : -1)
      const shift = 28 * stack
      const place = horizontal
        ? { x: (chain.baseP1.x + next.x) / 2, y: chain.basePlace.y + sign * shift }
        : { x: chain.basePlace.x + sign * shift, y: (chain.baseP1.y + next.y) / 2 }
      return { dim: 'linear', points: [chain.baseP1, next, place], chain: { ...chain, p2: next, place, stack } }
    }
    if (!far(chain.baseP1, next)) return null
    const off = signedOffset(chain.baseP1, chain.p2, chain.basePlace)
    const sign = off >= 0 ? 1 : -1
    const place = placeOnOffset(chain.baseP1, next, off + sign * 28 * stack)
    return { dim: 'aligned', points: [chain.baseP1, next, place], chain: { ...chain, p2: next, place, stack } }
  }
  if (tool === 'angular' || tool === 'arc') {
    if (!far(pts[0], pts[1]) || !far(pts[0], pts[2])) return null
    if (Math.abs(sweepOf(pts[0], pts[1], pts[2])) < 0.02) return null
    return { dim: tool, points: pts, chain }
  }
  if (tool === 'radius' || tool === 'diameter') {
    if (!far(pts[0], pts[1])) return null
    return { dim: tool, points: pts, chain }
  }
  if (tool === 'jogged') {
    if (!far(pts[0], pts[1])) return null
    return { dim: 'jogged', points: pts, chain }
  }
  if (!far(pts[0], pts[1])) return null
  return { dim: 'ordinate', points: pts, chain }
}

export type DimLinePick = { a: WhiteboardPoint; b: WhiteboardPoint; at: WhiteboardPoint }

export type DimCirclePick = { cx: number; cy: number; r: number }

export function nearestDimCircle(objects: WhiteboardObject[], p: WhiteboardPoint, thresh: number): DimCirclePick | null {
  let best: (DimCirclePick & { d: number }) | null = null
  for (const obj of objects) {
    if (obj.kind !== 'shape' || obj.shape !== 'circle' || obj.cx == null || obj.cy == null || obj.r == null) continue
    const d = Math.abs(Math.hypot(p.x - obj.cx, p.y - obj.cy) - obj.r)
    if (d <= thresh && (!best || d < best.d)) best = { cx: obj.cx, cy: obj.cy, r: obj.r, d }
  }
  return best ? { cx: best.cx, cy: best.cy, r: best.r } : null
}

function rimToward(circle: DimCirclePick, place: WhiteboardPoint): WhiteboardPoint {
  const dx = place.x - circle.cx
  const dy = place.y - circle.cy
  const len = Math.hypot(dx, dy) || 1
  return { x: circle.cx + (dx / len) * circle.r, y: circle.cy + (dy / len) * circle.r }
}

/** Bán kính, đường kính, bán kính gãy lấy số của đường tròn đã chọn. */
export function measurePickedCircle(
  tool: 'radius' | 'diameter' | 'jogged',
  circle: DimCirclePick,
  place: WhiteboardPoint,
): ComposedDim | null {
  const center = { x: circle.cx, y: circle.cy }
  const rim = rimToward(circle, place)
  if (tool === 'jogged') return composeDim('jogged', [center, rim, place], null)
  return composeDim(tool, [center, rim], null)
}

/** Thẳng, song song, nhanh lấy độ dài của đoạn đã chọn. */
export function measurePickedLine(
  tool: 'linear' | 'aligned' | 'quick',
  seg: { a: WhiteboardPoint; b: WhiteboardPoint },
  place: WhiteboardPoint,
): ComposedDim | null {
  if (tool === 'linear') return composeDim('linear', [seg.a, seg.b, place], null)
  return composeDim('aligned', [seg.a, seg.b, place], null)
}

export function nearestDimLine(
  objects: WhiteboardObject[],
  p: WhiteboardPoint,
  thresh: number,
): { a: WhiteboardPoint; b: WhiteboardPoint } | null {
  let best: { a: WhiteboardPoint; b: WhiteboardPoint; d: number } | null = null
  for (const seg of straightSegments(objects)) {
    const d = pointToSegment(p, seg.a, seg.b)
    if (d <= thresh && (!best || d < best.d)) best = { a: seg.a, b: seg.b, d }
  }
  return best ? { a: best.a, b: best.b } : null
}

export function sameDimLine(
  p: { a: WhiteboardPoint; b: WhiteboardPoint },
  q: { a: WhiteboardPoint; b: WhiteboardPoint },
): boolean {
  const close = (a: WhiteboardPoint, b: WhiteboardPoint) => dist(a, b) < 2
  return (close(p.a, q.a) && close(p.b, q.b)) || (close(p.a, q.b) && close(p.b, q.a))
}

function projectOnLine(p: WhiteboardPoint, a: WhiteboardPoint, b: WhiteboardPoint): WhiteboardPoint {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const len2 = abx * abx + aby * aby || 1
  const t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2
  return { x: a.x + abx * t, y: a.y + aby * t }
}

function sharedEnd(p: DimLinePick, q: DimLinePick): WhiteboardPoint | null {
  const ends = [p.a, p.b]
  for (const a of ends) {
    if (dist(a, q.a) < 1.5 || dist(a, q.b) < 1.5) return a
  }
  return null
}

function lineMeet(p: DimLinePick, q: DimLinePick): WhiteboardPoint | null {
  const rx = p.b.x - p.a.x
  const ry = p.b.y - p.a.y
  const sx = q.b.x - q.a.x
  const sy = q.b.y - q.a.y
  const den = rx * sy - ry * sx
  if (Math.abs(den) < 1e-6) return null
  const t = ((q.a.x - p.a.x) * sy - (q.a.y - p.a.y) * sx) / den
  const hit = { x: p.a.x + rx * t, y: p.a.y + ry * t }
  const reach = Math.max(dist(p.a, p.b), dist(q.a, q.b), 32) * 8
  const midP = { x: (p.a.x + p.b.x) / 2, y: (p.a.y + p.b.y) / 2 }
  const midQ = { x: (q.a.x + q.b.x) / 2, y: (q.a.y + q.b.y) / 2 }
  if (dist(hit, midP) > reach && dist(hit, midQ) > reach) return null
  return hit
}

function rayFrom(vertex: WhiteboardPoint, seg: DimLinePick): WhiteboardPoint | null {
  const on = projectOnLine(seg.at, seg.a, seg.b)
  if (dist(vertex, on) >= 2) return on
  const da = dist(vertex, seg.a)
  const db = dist(vertex, seg.b)
  if (da < 2 && db < 2) return null
  return da >= db ? seg.a : seg.b
}

function turn(angle: number): number {
  const t = angle % (Math.PI * 2)
  return t < 0 ? t + Math.PI * 2 : t
}

/** Góc giữa hai đường đã chọn, về phía chỗ đặt kích thước. */
export function angleAtPlace(
  first: { a: WhiteboardPoint; b: WhiteboardPoint },
  second: { a: WhiteboardPoint; b: WhiteboardPoint },
  place: WhiteboardPoint,
): [WhiteboardPoint, WhiteboardPoint, WhiteboardPoint] | null {
  const vertex = sharedEnd({ ...first, at: first.a }, { ...second, at: second.a }) ?? lineMeet({ ...first, at: first.a }, { ...second, at: second.a })
  if (!vertex) return null
  const d1 = Math.atan2(first.b.y - first.a.y, first.b.x - first.a.x)
  const d2 = Math.atan2(second.b.y - second.a.y, second.b.x - second.a.x)
  const dirs = [d1, d1 + Math.PI, d2, d2 + Math.PI].map(turn).sort((a, b) => a - b)
  const aim = turn(Math.atan2(place.y - vertex.y, place.x - vertex.x))
  let idx = 0
  for (let i = 0; i < dirs.length; i += 1) {
    const a = dirs[i]
    const b = dirs[(i + 1) % dirs.length]
    const inside = a <= b ? aim >= a - 1e-6 && aim <= b + 1e-6 : aim >= a - 1e-6 || aim <= b + 1e-6
    if (inside) {
      idx = i
      break
    }
  }
  const a0 = dirs[idx]
  const a1 = dirs[(idx + 1) % dirs.length]
  const arm = (ang: number) => ({ x: vertex.x + Math.cos(ang) * 48, y: vertex.y + Math.sin(ang) * 48 })
  const armA = arm(a0)
  const armB = arm(a1)
  if (Math.abs(sweepOf(vertex, armA, armB)) < 0.02) return null
  return [vertex, armA, armB]
}

/** Chuỗi tiếp tục hoặc đường gióng lấy từ một kích thước đã có. */
export function chainFromDim(dim: Pick<WhiteboardDim, 'dim' | 'points'>): DimChain | null {
  if ((dim.dim !== 'linear' && dim.dim !== 'aligned') || dim.points.length < 3) return null
  const [p1, p2, place] = dim.points
  return { mode: dim.dim, baseP1: p1, p2, place, basePlace: place, stack: 0 }
}

/** Chiều dài cung của cả đường tròn đã chọn. */
export function measurePickedArc(circle: DimCirclePick, place: WhiteboardPoint): ComposedDim | null {
  const center = { x: circle.cx, y: circle.cy }
  const rim = rimToward(circle, place)
  const away = Math.hypot(place.x - circle.cx, place.y - circle.cy)
  const len = away || 1
  const ux = (place.x - circle.cx) / len
  const uy = (place.y - circle.cy) / len
  const textAt = Math.abs(away - circle.r) > Math.max(8, circle.r * 0.35)
    ? place
    : { x: circle.cx + ux * (circle.r + 36), y: circle.cy + uy * (circle.r + 36) }
  return { dim: 'arc', points: [center, rim, textAt], chain: null }
}

/** Góc giữa hai đường thẳng, về phía hai chỗ vừa bấm. */
export function angleFromTwoLines(
  first: DimLinePick,
  second: DimLinePick,
): [WhiteboardPoint, WhiteboardPoint, WhiteboardPoint] | null {
  if (sameDimLine(first, second)) return null
  const vertex = sharedEnd(first, second) ?? lineMeet(first, second)
  if (!vertex) return null
  const armA = rayFrom(vertex, first)
  const armB = rayFrom(vertex, second)
  if (!armA || !armB) return null
  if (Math.abs(sweepOf(vertex, armA, armB)) < 0.02) return null
  return [vertex, armA, armB]
}

export function dimLabel(dim: Pick<WhiteboardDim, 'dim' | 'points'>): string {
  const p = dim.points
  if (dim.dim === 'linear' && p.length >= 3) {
    const horizontal = linearIsHorizontal(p[0], p[1], p[2])
    return formatGridMeasure(horizontal ? Math.abs(p[1].x - p[0].x) : Math.abs(p[1].y - p[0].y))
  }
  if (dim.dim === 'aligned' && p.length >= 2) {
    return formatGridMeasure(Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y))
  }
  if (dim.dim === 'angular' && p.length >= 3) {
    return `${formatLineAngle((Math.abs(sweepOf(p[0], p[1], p[2])) * 180) / Math.PI)}°`
  }
  if (dim.dim === 'arc' && p.length >= 3) {
    const r = Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y)
    const place = Math.hypot(p[2].x - p[0].x, p[2].y - p[0].y)
    if (Math.abs(place - r) > Math.max(8, r * 0.35)) return formatGridMeasure(r * Math.PI * 2)
    return formatGridMeasure(r * Math.abs(sweepOf(p[0], p[1], p[2])))
  }
  if ((dim.dim === 'radius' || dim.dim === 'jogged') && p.length >= 2) {
    return `R ${formatGridMeasure(Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y))}`
  }
  if (dim.dim === 'diameter' && p.length >= 2) {
    return `Ø ${formatGridMeasure(Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y) * 2)}`
  }
  if (dim.dim === 'ordinate' && p.length >= 2) {
    const yLeader = Math.abs(p[1].x - p[0].x) >= Math.abs(p[1].y - p[0].y)
    return yLeader ? `Y ${formatGridMeasure(-p[0].y)}` : `X ${formatGridMeasure(p[0].x)}`
  }
  return ''
}

function strokeSeg(ctx: CanvasRenderingContext2D, a: WhiteboardPoint, b: WhiteboardPoint) {
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.stroke()
}

function filledArrow(ctx: CanvasRenderingContext2D, tip: WhiteboardPoint, from: WhiteboardPoint, ui: number) {
  const ang = Math.atan2(tip.y - from.y, tip.x - from.x)
  const len = 11 * ui
  const spread = 0.4
  ctx.beginPath()
  ctx.moveTo(tip.x, tip.y)
  ctx.lineTo(tip.x - len * Math.cos(ang - spread), tip.y - len * Math.sin(ang - spread))
  ctx.lineTo(tip.x - len * Math.cos(ang + spread), tip.y - len * Math.sin(ang + spread))
  ctx.closePath()
  ctx.fill()
}

function extension(ctx: CanvasRenderingContext2D, from: WhiteboardPoint, to: WhiteboardPoint, ui: number) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy) || 1
  if (len < 8 * ui) return
  const ux = dx / len
  const uy = dy / len
  strokeSeg(ctx, { x: from.x + ux * 4 * ui, y: from.y + uy * 4 * ui }, { x: to.x + ux * 6 * ui, y: to.y + uy * 6 * ui })
}

function dimensionLine(ctx: CanvasRenderingContext2D, a: WhiteboardPoint, b: WhiteboardPoint, ui: number) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const inset = Math.min(10 * ui, len * 0.2)
  strokeSeg(ctx, { x: a.x + ux * inset, y: a.y + uy * inset }, { x: b.x - ux * inset, y: b.y - uy * inset })
  filledArrow(ctx, a, { x: a.x + ux * 24 * ui, y: a.y + uy * 24 * ui }, ui)
  filledArrow(ctx, b, { x: b.x - ux * 24 * ui, y: b.y - uy * 24 * ui }, ui)
}

function rotatedText(ctx: CanvasRenderingContext2D, text: string, a: WhiteboardPoint, b: WhiteboardPoint, color: string, ui: number) {
  const mx = (a.x + b.x) / 2
  const my = (a.y + b.y) / 2
  let ang = Math.atan2(b.y - a.y, b.x - a.x)
  if (ang > Math.PI / 2 || ang < -Math.PI / 2) ang += Math.PI
  ctx.save()
  ctx.translate(mx, my)
  ctx.rotate(ang)
  ctx.font = `600 ${13 * ui}px ui-sans-serif, system-ui`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.lineWidth = 3 * ui
  ctx.strokeStyle = '#f8fafc'
  ctx.strokeText(text, 0, -4 * ui)
  ctx.fillStyle = color
  ctx.fillText(text, 0, -4 * ui)
  ctx.restore()
}

function plainText(ctx: CanvasRenderingContext2D, text: string, at: WhiteboardPoint, color: string, ui: number) {
  ctx.save()
  ctx.font = `600 ${13 * ui}px ui-sans-serif, system-ui`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 3 * ui
  ctx.strokeStyle = '#f8fafc'
  ctx.strokeText(text, at.x + 6 * ui, at.y)
  ctx.fillStyle = color
  ctx.fillText(text, at.x + 6 * ui, at.y)
  ctx.restore()
}

export function drawWhiteboardDim(
  ctx: CanvasRenderingContext2D,
  dim: WhiteboardDim,
  cam: WhiteboardCamera,
  w: number,
  h: number,
) {
  const text = dimLabel(dim)
  if (!text || dim.points.length < 2) return
  const s = (p: WhiteboardPoint) => worldToScreen(p, cam, w, h)
  const scale = cam.scale || 1
  const ui = whiteboardChromeScale(scale)
  ctx.save()
  ctx.strokeStyle = dim.color
  ctx.fillStyle = dim.color
  ctx.lineWidth = 1.25 * ui
  ctx.lineCap = 'butt'
  ctx.setLineDash([])

  if (dim.dim === 'linear' && dim.points.length >= 3) {
    const [p1, p2, place] = dim.points
    const horizontal = linearIsHorizontal(p1, p2, place)
    const a = s(horizontal ? { x: p1.x, y: place.y } : { x: place.x, y: p1.y })
    const b = s(horizontal ? { x: p2.x, y: place.y } : { x: place.x, y: p2.y })
    extension(ctx, s(p1), a, ui)
    extension(ctx, s(p2), b, ui)
    dimensionLine(ctx, a, b, ui)
    rotatedText(ctx, text, a, b, dim.color, ui)
  } else if (dim.dim === 'aligned' && dim.points.length >= 3) {
    const [p1, p2, place] = dim.points
    const off = signedOffset(p1, p2, place)
    const dx = p2.x - p1.x
    const dy = p2.y - p1.y
    const len = Math.hypot(dx, dy) || 1
    const nx = -dy / len
    const ny = dx / len
    const a = s({ x: p1.x + nx * off, y: p1.y + ny * off })
    const b = s({ x: p2.x + nx * off, y: p2.y + ny * off })
    extension(ctx, s(p1), a, ui)
    extension(ctx, s(p2), b, ui)
    dimensionLine(ctx, a, b, ui)
    rotatedText(ctx, text, a, b, dim.color, ui)
  } else if ((dim.dim === 'angular' || dim.dim === 'arc') && dim.points.length >= 3) {
    const [c, armA, armB] = dim.points
    const armR = Math.hypot(armA.x - c.x, armA.y - c.y)
    const placeR = Math.hypot(armB.x - c.x, armB.y - c.y)
    if (dim.dim === 'arc' && Math.abs(placeR - armR) > Math.max(8, armR * 0.35)) {
      const sc = s(c)
      ctx.beginPath()
      ctx.arc(sc.x, sc.y, armR * 1.12 * scale, 0, Math.PI * 2)
      ctx.stroke()
      plainText(ctx, text, s(armB), dim.color, ui)
    } else {
    const sweep = sweepOf(c, armA, armB)
    const radius = dim.dim === 'arc'
      ? Math.hypot(armA.x - c.x, armA.y - c.y) * 1.18
      : Math.max(28, Math.min(Math.hypot(armA.x - c.x, armA.y - c.y), Math.hypot(armB.x - c.x, armB.y - c.y)) * 0.55)
    const sc = s(c)
    const a0 = Math.atan2(armA.y - c.y, armA.x - c.x)
    const sr = radius * scale
    ctx.beginPath()
    ctx.arc(sc.x, sc.y, sr, a0, a0 + sweep, sweep < 0)
    ctx.stroke()
    const endA = s({ x: c.x + Math.cos(a0) * radius, y: c.y + Math.sin(a0) * radius })
    const endB = s({ x: c.x + Math.cos(a0 + sweep) * radius, y: c.y + Math.sin(a0 + sweep) * radius })
    extension(ctx, s(armA), endA, ui)
    extension(ctx, s(armB), endB, ui)
    const tanA = sweep < 0 ? -1 : 1
    filledArrow(ctx, endA, {
      x: endA.x + Math.cos(a0 + Math.PI / 2 * tanA) * 16 * ui,
      y: endA.y + Math.sin(a0 + Math.PI / 2 * tanA) * 16 * ui,
    }, ui)
    filledArrow(ctx, endB, {
      x: endB.x + Math.cos(a0 + sweep - Math.PI / 2 * tanA) * 16 * ui,
      y: endB.y + Math.sin(a0 + sweep - Math.PI / 2 * tanA) * 16 * ui,
    }, ui)
    const mid = a0 + sweep / 2
    const labelAt = s({ x: c.x + Math.cos(mid) * (radius + 16), y: c.y + Math.sin(mid) * (radius + 16) })
    plainText(ctx, text, labelAt, dim.color, ui)
    }
  } else if (dim.dim === 'radius' && dim.points.length >= 2) {
    const a = s(dim.points[0])
    const b = s(dim.points[1])
    dimensionLine(ctx, a, b, ui)
    rotatedText(ctx, text, a, b, dim.color, ui)
  } else if (dim.dim === 'diameter' && dim.points.length >= 2) {
    const c = dim.points[0]
    const rim = dim.points[1]
    const other = { x: c.x * 2 - rim.x, y: c.y * 2 - rim.y }
    const a = s(other)
    const b = s(rim)
    dimensionLine(ctx, a, b, ui)
    rotatedText(ctx, text, a, b, dim.color, ui)
  } else if (dim.dim === 'jogged' && dim.points.length >= 2) {
    const c = dim.points[0]
    const rim = dim.points[1]
    const dx = rim.x - c.x
    const dy = rim.y - c.y
    const len = Math.hypot(dx, dy) || 1
    const ux = dx / len
    const uy = dy / len
    const px = -uy
    const py = ux
    const pRim = s(rim)
    const pIn = s({ x: rim.x - ux * len * 0.28, y: rim.y - uy * len * 0.28 })
    const pJog = s({ x: rim.x - ux * len * 0.28 + px * 14, y: rim.y - uy * len * 0.28 + py * 14 })
    const pTail = s({ x: rim.x - ux * len * 0.62 + px * 14, y: rim.y - uy * len * 0.62 + py * 14 })
    strokeSeg(ctx, pRim, pIn)
    strokeSeg(ctx, pIn, pJog)
    strokeSeg(ctx, pJog, pTail)
    filledArrow(ctx, pRim, pIn, ui)
    rotatedText(ctx, text, pIn, pTail, dim.color, ui)
  } else if (dim.dim === 'ordinate' && dim.points.length >= 2) {
    const feature = s(dim.points[0])
    const place = s(dim.points[1])
    const yLeader = Math.abs(dim.points[1].x - dim.points[0].x) >= Math.abs(dim.points[1].y - dim.points[0].y)
    const knee = yLeader ? { x: place.x, y: feature.y } : { x: feature.x, y: place.y }
    strokeSeg(ctx, feature, knee)
    if (Math.hypot(knee.x - place.x, knee.y - place.y) > 2 * ui) strokeSeg(ctx, knee, place)
    plainText(ctx, text, place, dim.color, ui)
  }
  ctx.restore()
}
