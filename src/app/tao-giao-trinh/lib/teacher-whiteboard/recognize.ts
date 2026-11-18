import { boundsOf, centroid, dist, pathLength, pointToSegment, simplifyRdp } from './geometry'
import type { WhiteboardPoint, WhiteboardShape, WhiteboardShapeKind } from './types'

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

export function shapeKindLabel(kind: WhiteboardShapeKind): WhiteboardShapeKind {
  return kind
}

export function boundsHint(points: WhiteboardPoint[]): { w: number; h: number } {
  const b = boundsOf(points)
  return { w: b.maxX - b.minX, h: b.maxY - b.minY }
}
