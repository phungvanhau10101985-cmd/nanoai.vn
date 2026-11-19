import { boundsOf, centroid, dist, pathLength, pointToSegment, simplifyRdp } from './geometry'
import { orientTrapezoid } from './quad'
import type { WhiteboardObject, WhiteboardPoint, WhiteboardShape, WhiteboardShapeKind } from './types'

export type RecognizeResult = Omit<WhiteboardShape, 'id' | 'color' | 'size'>

function isClosed(points: WhiteboardPoint[], len: number): boolean {
  if (points.length < 8 || len < 24) return false
  const gap = dist(points[0], points[points.length - 1])
  return gap < Math.max(28, len * 0.18)
}

function fitLine(points: WhiteboardPoint[]): { a: WhiteboardPoint; b: WhiteboardPoint; rms: number } | null {
  if (points.length < 2) return null
  const a = points[0]
  const b = points[points.length - 1]
  const chord = dist(a, b)
  if (chord < 16) return null
  let err = 0
  for (const p of points) err += pointToSegment(p, a, b) ** 2
  const rms = Math.sqrt(err / points.length)
  return { a, b, rms }
}

function fitCircle(points: WhiteboardPoint[]): { cx: number; cy: number; r: number; rms: number } | null {
  if (points.length < 8) return null
  let sumX = 0
  let sumY = 0
  let sumX2 = 0
  let sumY2 = 0
  let sumXY = 0
  let sumX3 = 0
  let sumY3 = 0
  let sumX2Y = 0
  let sumXY2 = 0
  const n = points.length
  for (const p of points) {
    const x = p.x
    const y = p.y
    const x2 = x * x
    const y2 = y * y
    sumX += x
    sumY += y
    sumX2 += x2
    sumY2 += y2
    sumXY += x * y
    sumX3 += x2 * x
    sumY3 += y2 * y
    sumX2Y += x2 * y
    sumXY2 += x * y2
  }
  const a = n * sumX2 - sumX * sumX
  const b = n * sumXY - sumX * sumY
  const c = n * sumY2 - sumY * sumY
  const d = 0.5 * (n * (sumX3 + sumXY2) - sumX * (sumX2 + sumY2))
  const e = 0.5 * (n * (sumY3 + sumX2Y) - sumY * (sumX2 + sumY2))
  const det = a * c - b * b
  if (Math.abs(det) < 1e-6) return null
  const cx = (d * c - b * e) / det
  const cy = (a * e - b * d) / det
  const r = Math.sqrt(Math.max(1, cx * cx + cy * cy + (sumX2 + sumY2 - 2 * cx * sumX - 2 * cy * sumY) / n))
  if (r < 12 || r > 4000) return null
  let err = 0
  for (const p of points) err += (Math.hypot(p.x - cx, p.y - cy) - r) ** 2
  return { cx, cy, r, rms: Math.sqrt(err / n) }
}

function pcaEllipse(points: WhiteboardPoint[]): { cx: number; cy: number; rx: number; ry: number; rotation: number; rms: number } | null {
  if (points.length < 10) return null
  const c = centroid(points)
  let xx = 0
  let xy = 0
  let yy = 0
  for (const p of points) {
    const dx = p.x - c.x
    const dy = p.y - c.y
    xx += dx * dx
    xy += dx * dy
    yy += dy * dy
  }
  const n = points.length
  xx /= n
  xy /= n
  yy /= n
  const split = Math.hypot(xx - yy, 2 * xy)
  const l1 = (xx + yy + split) / 2
  const l2 = (xx + yy - split) / 2
  const rotation = Math.abs(xy) < 1e-8 && xx >= yy ? 0 : Math.atan2(l1 - xx, xy)
  const rx = Math.sqrt(Math.max(1, l1)) * 2
  const ry = Math.sqrt(Math.max(1, l2)) * 2
  if (rx < 12 || ry < 8) return null
  let err = 0
  const cos = Math.cos(-rotation)
  const sin = Math.sin(-rotation)
  for (const p of points) {
    const dx = p.x - c.x
    const dy = p.y - c.y
    const lx = (dx * cos - dy * sin) / rx
    const ly = (dx * sin + dy * cos) / ry
    const radial = Math.hypot(lx, ly)
    err += (radial - 1) ** 2
  }
  return { cx: c.x, cy: c.y, rx, ry, rotation, rms: Math.sqrt(err / n) }
}

function cornerPoints(points: WhiteboardPoint[]): WhiteboardPoint[] {
  const len = pathLength(points)
  const simple = simplifyRdp(points, Math.max(8, len * 0.03))
  if (simple.length < 3) return simple
  const corners: WhiteboardPoint[] = [simple[0]]
  for (let i = 1; i < simple.length - 1; i += 1) {
    const a = simple[i - 1]
    const b = simple[i]
    const c = simple[i + 1]
    const ang1 = Math.atan2(b.y - a.y, b.x - a.x)
    const ang2 = Math.atan2(c.y - b.y, c.x - b.x)
    let delta = Math.abs(ang2 - ang1)
    if (delta > Math.PI) delta = 2 * Math.PI - delta
    if (delta > (28 * Math.PI) / 180) corners.push(b)
  }
  corners.push(simple[simple.length - 1])
  const dedup: WhiteboardPoint[] = []
  for (const p of corners) {
    const prev = dedup[dedup.length - 1]
    if (!prev || dist(prev, p) > 10) dedup.push(p)
  }
  if (dedup.length >= 2 && dist(dedup[0], dedup[dedup.length - 1]) < 16) dedup.pop()
  return dedup
}

function almostRight(a: WhiteboardPoint, b: WhiteboardPoint, c: WhiteboardPoint): boolean {
  const ux = a.x - b.x
  const uy = a.y - b.y
  const vx = c.x - b.x
  const vy = c.y - b.y
  const lu = Math.hypot(ux, uy)
  const lv = Math.hypot(vx, vy)
  if (lu < 8 || lv < 8) return false
  const cos = (ux * vx + uy * vy) / (lu * lv)
  return Math.abs(cos) < 0.35
}

function asArrow(points: WhiteboardPoint[], line: { a: WhiteboardPoint; b: WhiteboardPoint }): RecognizeResult | null {
  const simple = simplifyRdp(points, 10)
  if (simple.length < 3) return null
  const shaft = dist(line.a, line.b)
  if (shaft < 36) return null
  const head = simple.slice(-3)
  const tip = head[head.length - 1]
  const wingSpan = dist(head[0], head[head.length - 1 === 0 ? 0 : head.length - 2] ?? head[0])
  if (wingSpan < 8) return null
  const nearEnd = dist(tip, line.b) < dist(tip, line.a)
  return {
    kind: 'shape',
    shape: 'arrow',
    points: nearEnd ? [line.a, line.b] : [line.b, line.a],
  }
}

function nearestIndex(points: WhiteboardPoint[], corner: WhiteboardPoint): number {
  let best = 0
  let bestD = Infinity
  for (let i = 0; i < points.length; i += 1) {
    const d = dist(points[i], corner)
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
}

function slicePath(points: WhiteboardPoint[], from: number, to: number): WhiteboardPoint[] {
  if (from <= to) return points.slice(from, to + 1)
  return [...points.slice(from), ...points.slice(0, to + 1)]
}

function sidesAreStraight(points: WhiteboardPoint[], corners: WhiteboardPoint[]): boolean {
  if (corners.length < 3 || points.length < 8) return false
  const idxs = corners.map((c) => nearestIndex(points, c))
  for (let i = 0; i < corners.length; i += 1) {
    const a = corners[i]
    const b = corners[(i + 1) % corners.length]
    const chord = dist(a, b)
    if (chord < 18) return false
    const along = slicePath(points, idxs[i], idxs[(i + 1) % corners.length])
    if (along.length < 2) return false
    let err = 0
    for (const p of along) err += pointToSegment(p, a, b) ** 2
    if (Math.sqrt(err / along.length) / chord > 0.08) return false
  }
  return true
}

function signedArea(corners: WhiteboardPoint[]): number {
  let area = 0
  for (let i = 0; i < corners.length; i += 1) {
    const p = corners[i]
    const q = corners[(i + 1) % corners.length]
    area += p.x * q.y - q.x * p.y
  }
  return area / 2
}

function isConvex(corners: WhiteboardPoint[]): boolean {
  let sign = 0
  for (let i = 0; i < corners.length; i += 1) {
    const a = corners[i]
    const b = corners[(i + 1) % corners.length]
    const c = corners[(i + 2) % corners.length]
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)
    if (Math.abs(cross) < 8) continue
    const next = Math.sign(cross)
    if (sign === 0) sign = next
    else if (next !== sign) return false
  }
  return sign !== 0
}

function similarLen(a: number, b: number, tol = 0.16): boolean {
  return Math.abs(a - b) <= tol * Math.max(a, b, 1)
}

function vec(a: WhiteboardPoint, b: WhiteboardPoint): WhiteboardPoint {
  return { x: b.x - a.x, y: b.y - a.y }
}

function parallelVec(u: WhiteboardPoint, v: WhiteboardPoint): boolean {
  const lu = Math.hypot(u.x, u.y)
  const lv = Math.hypot(v.x, v.y)
  if (lu < 8 || lv < 8) return false
  return Math.abs(u.x * v.y - u.y * v.x) / (lu * lv) < 0.2
}

function rightVec(u: WhiteboardPoint, v: WhiteboardPoint): boolean {
  const lu = Math.hypot(u.x, u.y)
  const lv = Math.hypot(v.x, v.y)
  if (lu < 8 || lv < 8) return false
  return Math.abs(u.x * v.x + u.y * v.y) / (lu * lv) < 0.3
}

function axisEdge(a: WhiteboardPoint, b: WhiteboardPoint): boolean {
  const dx = Math.abs(b.x - a.x)
  const dy = Math.abs(b.y - a.y)
  const span = Math.hypot(dx, dy)
  return span > 8 && (dx / span < 0.22 || dy / span < 0.22)
}

function parallelogramPoints(corners: WhiteboardPoint[]): WhiteboardPoint[] {
  const [a, b, c, d] = corners
  const center = centroid(corners)
  const u0 = { x: (a.x - c.x) / 2, y: (a.y - c.y) / 2 }
  const u1 = { x: (b.x - d.x) / 2, y: (b.y - d.y) / 2 }
  return [
    { x: center.x + u0.x, y: center.y + u0.y },
    { x: center.x + u1.x, y: center.y + u1.y },
    { x: center.x - u0.x, y: center.y - u0.y },
    { x: center.x - u1.x, y: center.y - u1.y },
  ]
}

function rhombusPoints(corners: WhiteboardPoint[]): WhiteboardPoint[] {
  const [a, b, , d] = parallelogramPoints(corners)
  const ab = dist(a, b)
  const ad = dist(a, d)
  const side = (ab + ad) / 2
  const ux = (b.x - a.x) / (ab || 1)
  const uy = (b.y - a.y) / (ab || 1)
  const vx = (d.x - a.x) / (ad || 1)
  const vy = (d.y - a.y) / (ad || 1)
  const b2 = { x: a.x + ux * side, y: a.y + uy * side }
  const d2 = { x: a.x + vx * side, y: a.y + vy * side }
  return [a, b2, { x: b2.x + (d2.x - a.x), y: b2.y + (d2.y - a.y) }, d2]
}

function squarePoints(corners: WhiteboardPoint[]): WhiteboardPoint[] {
  const [a, b] = corners
  const center = centroid(corners)
  const lens = corners.map((p, i) => dist(p, corners[(i + 1) % corners.length]))
  const side = lens.reduce((sum, n) => sum + n, 0) / lens.length
  const edge = dist(a, b) || 1
  const ux = (b.x - a.x) / edge
  const uy = (b.y - a.y) / edge
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  let px = -uy
  let py = ux
  if (px * (center.x - mid.x) + py * (center.y - mid.y) < 0) {
    px = -px
    py = -py
  }
  const half = side / 2
  return [
    { x: center.x - ux * half - px * half, y: center.y - uy * half - py * half },
    { x: center.x + ux * half - px * half, y: center.y + uy * half - py * half },
    { x: center.x + ux * half + px * half, y: center.y + uy * half + py * half },
    { x: center.x - ux * half + px * half, y: center.y - uy * half + py * half },
  ]
}

function regularPolygon(corners: WhiteboardPoint[]): WhiteboardPoint[] {
  const center = centroid(corners)
  const n = corners.length
  let radius = 0
  for (const p of corners) radius += Math.hypot(p.x - center.x, p.y - center.y)
  radius /= n
  const start = Math.atan2(corners[0].y - center.y, corners[0].x - center.x)
  const step = (signedArea(corners) >= 0 ? 1 : -1) * ((2 * Math.PI) / n)
  return Array.from({ length: n }, (_, i) => {
    const t = start + step * i
    return { x: center.x + radius * Math.cos(t), y: center.y + radius * Math.sin(t) }
  })
}

/** Vuông, thoi, bình hành, chữ nhật, hình thang, ngũ giác, lục giác. Ưu tiên cạnh thẳng hơn vòng tròn. */
function straightPolygon(points: WhiteboardPoint[], corners: WhiteboardPoint[]): RecognizeResult | null {
  const n = corners.length
  if (n < 4 || n > 6 || !isConvex(corners) || !sidesAreStraight(points, corners)) return null
  if (n === 5 || n === 6) {
    const lens = corners.map((p, i) => dist(p, corners[(i + 1) % n]))
    const longest = Math.max(...lens)
    const shortest = Math.min(...lens)
    if (shortest < 18 || longest > shortest * 1.65) return null
    return { kind: 'shape', shape: 'polygon', points: regularPolygon(corners) }
  }
  const [a, b, c, d] = corners
  const ab = dist(a, b)
  const bc = dist(b, c)
  const cd = dist(c, d)
  const da = dist(d, a)
  const sides = [ab, bc, cd, da]
  const equal = sides.every((len) => similarLen(len, sides[0], 0.18))
  const dirs = [vec(a, b), vec(b, c), vec(c, d), vec(d, a)]
  const rights = dirs.filter((dir, i) => rightVec(dirs[(i + dirs.length - 1) % dirs.length], dir)).length
  const para = parallelVec(dirs[0], dirs[2]) && parallelVec(dirs[1], dirs[3]) && similarLen(ab, cd, 0.22) && similarLen(bc, da, 0.22)
  const axis = [0, 1, 2, 3].every((i) => axisEdge(corners[i], corners[(i + 1) % 4]))
  if (equal && rights >= 3) return { kind: 'shape', shape: 'polygon', points: squarePoints(corners) }
  if (rights >= 3 && axis) {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const p of corners) {
      minX = Math.min(minX, p.x)
      minY = Math.min(minY, p.y)
      maxX = Math.max(maxX, p.x)
      maxY = Math.max(maxY, p.y)
    }
    return { kind: 'shape', shape: 'rect', points: [{ x: minX, y: minY }, { x: maxX, y: maxY }] }
  }
  if (equal && (para || rights < 3)) return { kind: 'shape', shape: 'polygon', points: rhombusPoints(corners) }
  if (para || rights >= 3) return { kind: 'shape', shape: 'polygon', points: parallelogramPoints(corners) }
  const trap = orientTrapezoid(corners)
  if (trap) return { kind: 'shape', shape: 'polygon', points: trap }
  return null
}

function closedShape(
  points: WhiteboardPoint[],
  corners: WhiteboardPoint[],
  ellipse: ReturnType<typeof pcaEllipse>,
  circle: ReturnType<typeof fitCircle>,
): RecognizeResult | null {
  if (circle && circle.rms / circle.r < 0.14) {
    return { kind: 'shape', shape: 'circle', points: [], cx: circle.cx, cy: circle.cy, r: circle.r }
  }
  if (ellipse && ellipse.rms < 0.16) {
    const round = Math.abs(ellipse.rx - ellipse.ry) / Math.max(ellipse.rx, ellipse.ry)
    if (round < 0.12 && circle) {
      return { kind: 'shape', shape: 'circle', points: [], cx: circle.cx, cy: circle.cy, r: circle.r }
    }
    return {
      kind: 'shape',
      shape: 'ellipse',
      points: [],
      cx: ellipse.cx,
      cy: ellipse.cy,
      rx: ellipse.rx,
      ry: ellipse.ry,
      rotation: ellipse.rotation,
    }
  }
  const n = corners.length
  if (n === 3 && sidesAreStraight(points, corners)) {
    return { kind: 'shape', shape: 'triangle', points: corners.slice(0, 3) }
  }
  if (n === 4) {
    const [a, b, c, d] = corners
    const rights = [almostRight(a, b, c), almostRight(b, c, d), almostRight(c, d, a), almostRight(d, a, b)].filter(Boolean).length
    if (rights >= 3 && sidesAreStraight(points, corners)) {
      const width = dist(a, b)
      const height = dist(b, c)
      const cx = (a.x + b.x + c.x + d.x) / 4
      const cy = (a.y + b.y + c.y + d.y) / 4
      const square = Math.abs(width - height) <= 0.12 * Math.max(width, height)
      const w = square ? (width + height) / 2 : width
      const h = square ? w : height
      return {
        kind: 'shape',
        shape: 'rect',
        points: [
          { x: cx - w / 2, y: cy - h / 2 },
          { x: cx + w / 2, y: cy + h / 2 },
        ],
      }
    }
  }
  return null
}

export function recognizeStroke(points: WhiteboardPoint[]): RecognizeResult | null {
  if (!Array.isArray(points) || points.length < 6) return null
  const len = pathLength(points)
  if (len < 28) return null
  const closed = isClosed(points, len)
  const line = fitLine(points)
  const circle = fitCircle(points)
  const ellipse = pcaEllipse(points)
  const corners = cornerPoints(points)

  if (!closed && line && line.rms / Math.max(1, dist(line.a, line.b)) < 0.045) {
    const arrow = corners.length >= 3 ? asArrow(points, line) : null
    if (arrow) return arrow
    return { kind: 'shape', shape: 'line', points: [line.a, line.b] }
  }

  if (closed) {
    const polygon = straightPolygon(points, corners)
    if (polygon) return polygon
    if (circle && circle.rms / circle.r < 0.12) {
      return { kind: 'shape', shape: 'circle', points: [], cx: circle.cx, cy: circle.cy, r: circle.r }
    }
    const shaped = closedShape(points, corners, ellipse, circle)
    if (shaped) return shaped
  }

  if (circle && closed && circle.rms / circle.r < 0.2) {
    return { kind: 'shape', shape: 'circle', points: [], cx: circle.cx, cy: circle.cy, r: circle.r }
  }
  return null
}

type StraightSeg = {
  id: string
  a: WhiteboardPoint
  b: WhiteboardPoint
  len: number
  color: string
  size: number
}

function straightSegment(obj: WhiteboardObject): StraightSeg | null {
  if (obj.kind === 'graph' || (obj.kind === 'stroke' && obj.tool === 'eraser')) return null
  if (obj.kind === 'shape' && (obj.triangle || obj.triangleLine || obj.shape === 'arrow')) return null
  let a: WhiteboardPoint
  let b: WhiteboardPoint
  let chord: number
  if (obj.kind === 'shape' && obj.shape === 'line' && obj.points.length >= 2) {
    a = obj.points[0]
    b = obj.points[obj.points.length - 1]
    chord = dist(a, b)
  } else if (obj.kind === 'stroke' && obj.points.length >= 2) {
    const line = fitLine(obj.points)
    if (!line) return null
    chord = dist(line.a, line.b)
    if (chord < 12 || line.rms / chord > 0.12) return null
    if (pathLength(obj.points) > chord * 1.45) return null
    a = line.a
    b = line.b
  } else return null
  if (chord < 12) return null
  return { id: obj.id, a, b, len: chord, color: obj.color, size: obj.size }
}

/** Cạnh tam giác vẽ tay: được gợn, miễn là đi từ đầu này sang đầu kia chứ không nguệch thành vòng. */
function triangleSide(obj: WhiteboardObject): StraightSeg | null {
  if (obj.kind === 'graph' || (obj.kind === 'stroke' && obj.tool === 'eraser')) return null
  if (obj.kind === 'shape' && (obj.triangle || obj.triangleLine || obj.shape === 'arrow' || obj.shape === 'circle' || obj.shape === 'ellipse')) return null
  let a: WhiteboardPoint
  let b: WhiteboardPoint
  if (obj.kind === 'shape' && obj.shape === 'line' && obj.points.length >= 2) {
    a = obj.points[0]
    b = obj.points[obj.points.length - 1]
  } else if (obj.kind === 'stroke' && obj.points.length >= 2) {
    const pts = obj.points
    a = pts[0]
    b = pts[pts.length - 1]
    const chord = dist(a, b)
    if (chord < 18) return null
    const len = pathLength(pts)
    if (len > chord * 3.2) return null
    if (isClosed(pts, len)) return null
    let maxDev = 0
    for (let i = 1; i < pts.length - 1; i += 1) {
      const d = pointToSegment(pts[i], a, b)
      if (d > maxDev) maxDev = d
    }
    if (maxDev > chord * 0.42) return null
  } else return null
  const chord = dist(a, b)
  if (chord < 18) return null
  return { id: obj.id, a, b, len: chord, color: obj.color, size: obj.size }
}

function unit(a: WhiteboardPoint, b: WhiteboardPoint): WhiteboardPoint | null {
  const len = dist(a, b)
  if (len < 1e-6) return null
  return { x: (b.x - a.x) / len, y: (b.y - a.y) / len }
}

/** Ba nét gần một đầu (thân + hai cánh) chụm về đỉnh rồi thành một mũi tên. points: [đuôi, đỉnh, cánh 1, cánh 2]. */
export function joinThreeStrokeArrow(
  objects: WhiteboardObject[],
  fresh: WhiteboardObject,
  radius = 56,
): { arrow: WhiteboardShape; removeIds: string[] } | null {
  if (!(radius > 0) || fresh.kind === 'graph' || (fresh.kind === 'stroke' && fresh.tool === 'eraser')) return null
  const pool = objects.some((obj) => obj.id === fresh.id) ? objects : [...objects, fresh]
  const segs = pool.map(straightSegment).filter((seg): seg is StraightSeg => seg != null)
  if (!segs.some((seg) => seg.id === fresh.id)) return null
  let best: {
    shaft: StraightSeg
    tail: WhiteboardPoint
    tip: WhiteboardPoint
    wings: { id: string; far: WhiteboardPoint; near: WhiteboardPoint }[]
  } | null = null
  for (const shaft of segs) {
    if (shaft.len < 40) continue
    const ends = [shaft.a, shaft.b]
    for (let end = 0; end < 2; end += 1) {
      const tip0 = ends[end]
      const tail = ends[1 - end]
      const shaftDir = unit(tail, tip0)
      if (!shaftDir) continue
      const wings: { id: string; far: WhiteboardPoint; near: WhiteboardPoint; side: number; gap: number }[] = []
      for (const wing of segs) {
        if (wing.id === shaft.id || wing.len > shaft.len * 0.7) continue
        const nearIsA = dist(wing.a, tip0) <= dist(wing.b, tip0)
        const near = nearIsA ? wing.a : wing.b
        const far = nearIsA ? wing.b : wing.a
        const gap = dist(near, tip0)
        if (gap > radius || dist(far, tip0) < wing.len * 0.55) continue
        const wingDir = unit(near, far)
        if (!wingDir) continue
        const forward = wingDir.x * shaftDir.x + wingDir.y * shaftDir.y
        const back = -forward
        if (back > 0.965 || back < 0.34) continue
        const side = shaftDir.x * wingDir.y - shaftDir.y * wingDir.x
        if (Math.abs(side) < 0.22) continue
        wings.push({ id: wing.id, far, near, side, gap })
      }
      const left = wings.filter((wing) => wing.side > 0).sort((p, q) => p.gap - q.gap)
      const right = wings.filter((wing) => wing.side < 0).sort((p, q) => p.gap - q.gap)
      if (!left[0] || !right[0]) continue
      const pair = [left[0], right[0]]
      const cluster = [tip0, pair[0].near, pair[1].near]
      let spread = 0
      for (let i = 0; i < cluster.length; i += 1) {
        for (let j = i + 1; j < cluster.length; j += 1) spread = Math.max(spread, dist(cluster[i], cluster[j]))
      }
      if (spread > radius) continue
      const ids = new Set([shaft.id, pair[0].id, pair[1].id])
      if (!ids.has(fresh.id)) continue
      if (!best || shaft.len > best.shaft.len) {
        best = { shaft, tail, tip: tip0, wings: pair.map((wing) => ({ id: wing.id, far: wing.far, near: wing.near })) }
      }
    }
  }
  if (!best) return null
  const tip = centroid([best.tip, best.wings[0].near, best.wings[1].near])
  if (dist(tip, best.tail) < 24) return null
  const removeIds = [best.shaft.id, best.wings[0].id, best.wings[1].id].filter((id) => id !== fresh.id && objects.some((obj) => obj.id === id))
  if (removeIds.length < 2) return null
  return {
    arrow: {
      kind: 'shape',
      shape: 'arrow',
      id: fresh.id,
      color: best.shaft.color,
      size: best.shaft.size,
      points: [best.tail, tip, best.wings[0].far, best.wings[1].far],
    },
    removeIds,
  }
}

function segEnd(seg: StraightSeg, index: 0 | 1): WhiteboardPoint {
  return index === 0 ? seg.a : seg.b
}

/** Góc được hở tới khoảng hai phần năm cạnh ngắn, không chỉ một khoảng pixel cố định. */
function cornerLimit(lenA: number, lenB: number, radius: number): number {
  const shorter = Math.min(lenA, lenB)
  return Math.min(shorter * 0.48, Math.max(radius, shorter * 0.42))
}

function closestEnds(a: StraightSeg, b: StraightSeg, radius: number): { ai: 0 | 1; bi: 0 | 1; gap: number } | null {
  const pairs: { ai: 0 | 1; bi: 0 | 1; gap: number }[] = [
    { ai: 0, bi: 0, gap: dist(a.a, b.a) },
    { ai: 0, bi: 1, gap: dist(a.a, b.b) },
    { ai: 1, bi: 0, gap: dist(a.b, b.a) },
    { ai: 1, bi: 1, gap: dist(a.b, b.b) },
  ].sort((p, q) => p.gap - q.gap)
  const limit = cornerLimit(a.len, b.len, radius)
  if (pairs[0].gap > limit || pairs[1].gap <= limit) return null
  return pairs[0]
}

/** Ba đoạn gần khép kín thì chụm đỉnh và nhận là tam giác. */
export function joinThreeStrokeTriangle(
  objects: WhiteboardObject[],
  fresh: WhiteboardObject,
  radius = 56,
): { corners: [WhiteboardPoint, WhiteboardPoint, WhiteboardPoint]; removeIds: string[] } | null {
  if (!(radius > 0) || fresh.kind === 'graph' || (fresh.kind === 'stroke' && fresh.tool === 'eraser')) return null
  const pool = objects.some((obj) => obj.id === fresh.id) ? objects : [...objects, fresh]
  const segs = pool.map(triangleSide).filter((seg): seg is StraightSeg => seg != null && seg.len >= 18)
  const freshSeg = segs.find((seg) => seg.id === fresh.id)
  if (!freshSeg) return null
  const others = segs.filter((seg) => {
    if (seg.id === freshSeg.id) return false
    const limit = cornerLimit(freshSeg.len, seg.len, radius)
    return dist(seg.a, freshSeg.a) <= limit
      || dist(seg.b, freshSeg.a) <= limit
      || dist(seg.a, freshSeg.b) <= limit
      || dist(seg.b, freshSeg.b) <= limit
  })
  let best: { gap: number; corners: [WhiteboardPoint, WhiteboardPoint, WhiteboardPoint]; removeIds: string[] } | null = null
  for (let i = 0; i < others.length; i += 1) {
    for (let j = i + 1; j < others.length; j += 1) {
      const left = others[i]
      const right = others[j]
      const ab = closestEnds(freshSeg, left, radius)
      const ac = closestEnds(freshSeg, right, radius)
      if (!ab || !ac || ab.ai === ac.ai) continue
      const bFree = (1 - ab.bi) as 0 | 1
      const cFree = (1 - ac.bi) as 0 | 1
      const bPoint = segEnd(left, bFree)
      const cPoint = segEnd(right, cFree)
      const bcGap = dist(bPoint, cPoint)
      if (bcGap > cornerLimit(left.len, right.len, radius)) continue
      const cornerAB = centroid([segEnd(freshSeg, ab.ai), segEnd(left, ab.bi)])
      const cornerAC = centroid([segEnd(freshSeg, ac.ai), segEnd(right, ac.bi)])
      const cornerBC = centroid([bPoint, cPoint])
      const corners: [WhiteboardPoint, WhiteboardPoint, WhiteboardPoint] = [cornerAB, cornerAC, cornerBC]
      const spans = [dist(cornerAB, cornerAC), dist(cornerAC, cornerBC), dist(cornerBC, cornerAB)]
      const lens = [freshSeg.len, right.len, left.len]
      const tols = [ab.gap + ac.gap, ac.gap + bcGap, ab.gap + bcGap]
      if (spans.some((span, index) => span < 18 || Math.abs(span - lens[index]) > Math.max(radius, tols[index]))) continue
      const area2 = Math.abs(
        (cornerAC.x - cornerAB.x) * (cornerBC.y - cornerAB.y) - (cornerAC.y - cornerAB.y) * (cornerBC.x - cornerAB.x),
      )
      if (area2 < 400) continue
      const removeIds = [left.id, right.id].filter((id) => objects.some((obj) => obj.id === id))
      if (removeIds.length < 2) continue
      const gap = ab.gap + ac.gap + bcGap
      if (!best || gap < best.gap) best = { gap, corners, removeIds }
    }
  }
  return best ? { corners: best.corners, removeIds: best.removeIds } : null
}

export function shapeKindLabel(kind: WhiteboardShapeKind): WhiteboardShapeKind {
  return kind
}

export function boundsHint(points: WhiteboardPoint[]): { w: number; h: number } {
  const b = boundsOf(points)
  return { w: b.maxX - b.minX, h: b.maxY - b.minY }
}
