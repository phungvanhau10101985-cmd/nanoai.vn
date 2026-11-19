import { dist } from './geometry'
import { lineFromMeasure, lineMeasure, normalizeLineAngle } from './line-measure'
import type { WhiteboardPoint } from './types'
import { WHITEBOARD_GRID } from './types'

export const WHITEBOARD_RULER_KINDS = ['length', 'protractor', 'set-square-45', 'set-square-60', 'compass'] as const
export type WhiteboardRulerKind = (typeof WHITEBOARD_RULER_KINDS)[number]

export type WhiteboardRuler = {
  /** Thiếu thì là thước đo chiều dài. */
  kind?: WhiteboardRulerKind
  x: number
  y: number
  length: number
  angleDeg: number
  /** Kim thước đo độ, 0–180 kể từ cạnh thẳng. */
  armDeg?: number
}

export function rulerKindOf(ruler: WhiteboardRuler): WhiteboardRulerKind {
  return ruler.kind ?? 'length'
}

/** Góc kim trên nửa vòng của thước đo độ. */
export function protractorArmDeg(baselineDeg: number, pointerDeg: number): number {
  const rel = normalizeLineAngle(pointerDeg - baselineDeg)
  if (rel <= 180) return rel
  const toZero = 360 - rel
  const toStraight = rel - 180
  return toZero <= toStraight ? 0 : 180
}

export function rulerEnd(ruler: WhiteboardRuler): WhiteboardPoint {
  return lineFromMeasure({ x: ruler.x, y: ruler.y }, ruler.length, ruler.angleDeg)[1]
}

export function rulerFromEnds(start: WhiteboardPoint, end: WhiteboardPoint, minLength = WHITEBOARD_GRID): WhiteboardRuler {
  const measured = lineMeasure(start, end)
  return {
    kind: 'length',
    x: start.x,
    y: start.y,
    length: Math.max(minLength, measured.length),
    angleDeg: measured.angleDeg,
  }
}

function pointAt(origin: WhiteboardPoint, length: number, angleDeg: number): WhiteboardPoint {
  return lineFromMeasure(origin, length, angleDeg)[1]
}

function projectOnSegment(a: WhiteboardPoint, b: WhiteboardPoint, p: WhiteboardPoint): WhiteboardPoint | null {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  if (len2 < 1) return null
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  return { x: a.x + t * dx, y: a.y + t * dy }
}

/** Các cạnh thẳng của thước. Compa không có cạnh. */
export function rulerSnapSegments(ruler: WhiteboardRuler): { a: WhiteboardPoint; b: WhiteboardPoint }[] {
  const kind = rulerKindOf(ruler)
  const origin = { x: ruler.x, y: ruler.y }
  const span = Math.max(WHITEBOARD_GRID, ruler.length)
  if (kind === 'length') return [{ a: origin, b: rulerEnd(ruler) }]
  if (kind === 'protractor') {
    return [
      { a: pointAt(origin, span, ruler.angleDeg + 180), b: pointAt(origin, span, ruler.angleDeg) },
      { a: origin, b: pointAt(origin, span, ruler.angleDeg + (ruler.armDeg ?? 0)) },
    ]
  }
  if (kind === 'set-square-45') {
    const far = pointAt(origin, span, ruler.angleDeg)
    const up = pointAt(origin, span, ruler.angleDeg + 90)
    return [{ a: origin, b: far }, { a: origin, b: up }, { b: far, a: up }]
  }
  if (kind === 'set-square-60') {
    const far = pointAt(origin, span, ruler.angleDeg)
    const up = pointAt(origin, span / Math.sqrt(3), ruler.angleDeg + 90)
    return [{ a: origin, b: far }, { a: origin, b: up }, { b: far, a: up }]
  }
  return []
}

/** Chiếu điểm lên mép thước hoặc vòng compa. Xa hơn maxDist thì không dính. */
export function projectOnRuler(ruler: WhiteboardRuler, p: WhiteboardPoint, maxDist: number): WhiteboardPoint | null {
  if (rulerKindOf(ruler) === 'compass') {
    const origin = { x: ruler.x, y: ruler.y }
    const radius = Math.max(WHITEBOARD_GRID, ruler.length)
    const d = dist(p, origin)
    if (d < 1 || Math.abs(d - radius) > maxDist) return null
    const scale = radius / d
    return { x: origin.x + (p.x - origin.x) * scale, y: origin.y + (p.y - origin.y) * scale }
  }
  let best: WhiteboardPoint | null = null
  let bestDist = maxDist
  for (const edge of rulerSnapSegments(ruler)) {
    const q = projectOnSegment(edge.a, edge.b, p)
    if (!q) continue
    const gap = dist(p, q)
    if (gap <= bestDist) {
      best = q
      bestDist = gap
    }
  }
  return best
}
