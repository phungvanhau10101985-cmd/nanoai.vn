import { dist } from './geometry'
import { parseSideLength, formatSideLength } from './triangle'
import type { QuadKind, QuadMark, WhiteboardPoint } from './types'

export type QuadSides = { ab: string; bc: string; cd: string; da: string }

function near(a: number, b: number, tol = 0.04): boolean {
  return Math.abs(a - b) <= tol * Math.max(a, b, 1e-6)
}

function signedArea(pts: WhiteboardPoint[]): number {
  let area = 0
  for (let i = 0; i < pts.length; i += 1) {
    const p = pts[i]
    const q = pts[(i + 1) % pts.length]
    area += p.x * q.y - q.x * p.y
  }
  return area / 2
}

function centroidOf(pts: WhiteboardPoint[]): WhiteboardPoint {
  let x = 0
  let y = 0
  for (const p of pts) {
    x += p.x
    y += p.y
  }
  return { x: x / pts.length, y: y / pts.length }
}

/** Góc trong tại một đỉnh, độ, từ 1 đến 179. */
export function angleAtCorner(corners: WhiteboardPoint[], index = 0): number {
  const cur = corners[index]
  const prev = corners[(index + corners.length - 1) % corners.length]
  const next = corners[(index + 1) % corners.length]
  const ux = prev.x - cur.x
  const uy = prev.y - cur.y
  const vx = next.x - cur.x
  const vy = next.y - cur.y
  const deg = (Math.atan2(Math.abs(ux * vy - uy * vx), ux * vx + uy * vy) * 180) / Math.PI
  if (!Number.isFinite(deg)) return 90
  return Math.max(1, Math.min(179, Math.round(deg)))
}

export function cornersOfQuad(shape: string, points: WhiteboardPoint[]): WhiteboardPoint[] | null {
  if (shape === 'rect' && points.length >= 2) {
    const minX = Math.min(points[0].x, points[1].x)
    const maxX = Math.max(points[0].x, points[1].x)
    const minY = Math.min(points[0].y, points[1].y)
    const maxY = Math.max(points[0].y, points[1].y)
    if (maxX - minX < 8 || maxY - minY < 8) return null
    return [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY },
    ]
  }
  if (shape === 'polygon' && points.length === 4) return points.slice(0, 4)
  return null
}

function sideVec(corners: WhiteboardPoint[], index: number): WhiteboardPoint {
  const a = corners[index]
  const b = corners[(index + 1) % 4]
  return { x: b.x - a.x, y: b.y - a.y }
}

function parallelSides(u: WhiteboardPoint, v: WhiteboardPoint): boolean {
  const lu = Math.hypot(u.x, u.y)
  const lv = Math.hypot(v.x, v.y)
  if (lu < 8 || lv < 8) return false
  return Math.abs(u.x * v.y - u.y * v.x) / (lu * lv) < 0.2
}

/** 0, 1 hoặc 2 cặp cạnh đối song song. */
export function parallelPairCount(corners: WhiteboardPoint[]): 0 | 1 | 2 {
  if (corners.length < 4) return 0
  const dirs = [0, 1, 2, 3].map((i) => sideVec(corners, i))
  let n = 0
  if (parallelSides(dirs[0], dirs[2])) n += 1
  if (parallelSides(dirs[1], dirs[3])) n += 1
  return n as 0 | 1 | 2
}

/** Xoay đỉnh để AB là đáy dài, CD là đáy kia, hai đáy song song. */
export function orientTrapezoid(corners: WhiteboardPoint[]): WhiteboardPoint[] | null {
  if (corners.length < 4 || parallelPairCount(corners) !== 1) return null
  const dirs = [0, 1, 2, 3].map((i) => sideVec(corners, i))
  let pts = corners.slice(0, 4)
  if (!parallelSides(dirs[0], dirs[2]) && parallelSides(dirs[1], dirs[3])) {
    pts = [pts[1], pts[2], pts[3], pts[0]]
  }
  if (dist(pts[2], pts[3]) > dist(pts[0], pts[1]) * 1.02) pts = [pts[2], pts[3], pts[0], pts[1]]
  return pts
}

/** Khoảng cách giữa hai đáy song song, sau khi đã xoay. */
export function trapezoidHeight(corners: WhiteboardPoint[]): number {
  const a = corners[0]
  const b = corners[1]
  const d = corners[3]
  const len = dist(a, b) || 1
  return Math.abs((d.x - a.x) * (b.y - a.y) - (d.y - a.y) * (b.x - a.x)) / len
}
export function guessQuadKind(corners: WhiteboardPoint[]): QuadKind {
  if (corners.length < 4) return 'parallelogram'
  const lens = [0, 1, 2, 3].map((i) => dist(corners[i], corners[(i + 1) % 4]))
  const equal = lens.every((len) => Math.abs(len - lens[0]) <= 0.18 * Math.max(len, lens[0], 1))
  let rights = 0
  for (let i = 0; i < 4; i += 1) {
    const prev = corners[(i + 3) % 4]
    const cur = corners[i]
    const next = corners[(i + 1) % 4]
    const ux = prev.x - cur.x
    const uy = prev.y - cur.y
    const vx = next.x - cur.x
    const vy = next.y - cur.y
    const lu = Math.hypot(ux, uy) || 1
    const lv = Math.hypot(vx, vy) || 1
    if (Math.abs(ux * vx + uy * vy) / (lu * lv) < 0.3) rights += 1
  }
  if (equal && rights >= 3) return 'square'
  if (rights >= 3) return 'rectangle'
  if (equal) return 'rhombus'
  const pairs = parallelPairCount(corners)
  if (pairs === 1) return 'trapezoid'
  return 'parallelogram'
}

export function sidesFromQuadSketch(corners: WhiteboardPoint[]): QuadSides {
  const [a, b, c, d] = corners
  return {
    ab: formatSideLength(dist(a, b)),
    bc: formatSideLength(dist(b, c)),
    cd: formatSideLength(dist(c, d)),
    da: formatSideLength(dist(d, a)),
  }
}

/** Vuông và thoi bốn cạnh bằng nhau. Chữ nhật và bình hành thì cạnh đối bằng nhau. Hình thang giữ hai đáy. */
export function fillQuadSides(kind: QuadKind, sides: QuadSides, edited: keyof QuadSides): QuadSides {
  if (kind === 'trapezoid') return { ...sides }
  const src = sides[edited] || sides.ab || sides.bc || sides.cd || sides.da
  if (kind === 'square' || kind === 'rhombus') return { ab: src, bc: src, cd: src, da: src }
  if (edited === 'bc' || edited === 'da') {
    const length = sides.ab || sides.cd
    return { ab: length, bc: sides[edited], cd: length, da: sides[edited] }
  }
  const width = sides.bc || sides.da
  return { ab: sides[edited], bc: width, cd: sides[edited], da: width }
}

export type QuadSideError = 'missing' | 'angle' | 'square' | 'opposite' | 'rhombus' | 'height'

export function quadSideError(kind: QuadKind, sides: QuadSides, angleRaw: string): QuadSideError | null {
  const ab = parseSideLength(sides.ab)
  const bc = parseSideLength(sides.bc)
  const cd = parseSideLength(sides.cd)
  const da = parseSideLength(sides.da)
  const angle = parseSideLength(angleRaw)
  if (kind === 'trapezoid') {
    if (ab == null || cd == null || !angleRaw.trim()) return 'missing'
    if (angle == null || angle <= 0) return 'height'
    return null
  }
  if (ab == null || bc == null || cd == null || da == null || angle == null) return 'missing'
  if (angle <= 0 || angle >= 180) return 'angle'
  if (kind === 'square') {
    if (!(near(ab, bc) && near(bc, cd) && near(cd, da))) return 'square'
    if (!near(angle, 90)) return 'angle'
  }
  if (kind === 'rectangle') {
    if (!near(ab, cd) || !near(bc, da)) return 'opposite'
    if (!near(angle, 90)) return 'angle'
  }
  if (kind === 'parallelogram' && (!near(ab, cd) || !near(bc, da))) return 'opposite'
  if (kind === 'rhombus' && !(near(ab, bc) && near(bc, cd) && near(cd, da))) return 'rhombus'
  return null
}

/**
 * Dựng tứ giác. Cạnh AB nằm ngang, trừ hình thoi thì đường chéo AC nằm ngang.
 * Tâm hình giữ ở tâm nét vẽ.
 */
export function placeQuad(mark: QuadMark, sketch: WhiteboardPoint[]): WhiteboardPoint[] | null {
  if (sketch.length < 4) return null
  const ab = parseSideLength(mark.ab)
  const bc = parseSideLength(mark.bc)
  const da = parseSideLength(mark.da)
  const angle = parseSideLength(mark.angle)
  if (ab == null || angle == null || angle <= 0) return null
  if (mark.kind !== 'trapezoid' && (bc == null || da == null || angle >= 180)) return null
  let ideal: WhiteboardPoint[]
  if (mark.kind === 'rhombus') {
    const rad = (angle * Math.PI) / 180
    const p = ab * Math.cos(rad / 2)
    const q = ab * Math.sin(rad / 2)
    if (p < 1e-3 || q < 1e-3) return null
    ideal = [
      { x: -p, y: 0 },
      { x: 0, y: q },
      { x: p, y: 0 },
      { x: 0, y: -q },
    ]
  } else if (mark.kind === 'trapezoid') {
    const top = parseSideLength(mark.cd)
    const height = Math.abs(angle)
    if (top == null || height < 1e-3 || ab < 1e-3) return null
    const overhang = (ab - top) / 2
    ideal = [
      { x: 0, y: 0 },
      { x: ab, y: 0 },
      { x: overhang + top, y: height },
      { x: overhang, y: height },
    ]
  } else {
    const base = ab
    const leg = mark.kind === 'rectangle' ? bc : mark.kind === 'square' ? ab : da
    if (leg == null) return null
    const deg = mark.kind === 'square' || mark.kind === 'rectangle' ? 90 : angle
    const rad = (deg * Math.PI) / 180
    const dx = leg * Math.cos(rad)
    const dy = leg * Math.sin(rad)
    if (base < 1e-3 || Math.abs(dy) < 1e-3) return null
    ideal = [
      { x: 0, y: 0 },
      { x: base, y: 0 },
      { x: base + dx, y: dy },
      { x: dx, y: dy },
    ]
  }
  const corners = sketch.slice(0, 4)
  if (signedArea(corners) * signedArea(ideal) < 0) {
    ideal = ideal.map((p) => ({ x: p.x, y: -p.y }))
  }
  const from = centroidOf(ideal)
  const to = centroidOf(corners)
  return ideal.map((p) => ({
    x: to.x + (p.x - from.x),
    y: to.y + (p.y - from.y),
  }))
}
