import { dist } from './geometry'
import type { TriangleKind, TriangleMark, WhiteboardPoint } from './types'

export type TriangleSides = { ab: string; bc: string; ca: string }

export function parseSideLength(raw: string): number | null {
  const text = String(raw || '').trim().replace(',', '.')
  if (!text) return null
  const n = Number(text)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

export function formatSideLength(n: number): string {
  const rounded = Math.round(n * 1000) / 1000
  return String(rounded)
}

function near(a: number, b: number): boolean {
  return Math.abs(a - b) <= 0.04 * Math.max(a, b, 1e-6)
}

export function guessTriangleKind(ab: number, bc: number, ca: number): TriangleKind {
  const rightAtC = near(ab * ab, bc * bc + ca * ca)
  if (near(ab, bc) && near(bc, ca)) return 'equilateral'
  if (rightAtC && near(bc, ca)) return 'right-isosceles'
  if (rightAtC) return 'right'
  if (near(ab, ca) || near(ab, bc) || near(bc, ca)) return 'isosceles'
  return 'scalene'
}

export function sidesFromSketch(corners: WhiteboardPoint[]): TriangleSides {
  const [a, b, c] = corners
  return {
    ab: formatSideLength(dist(a, b)),
    bc: formatSideLength(dist(b, c)),
    ca: formatSideLength(dist(c, a)),
  }
}

/** Giữ đủ ba cạnh. Loại nào có cạnh phụ thuộc thì điền luôn cho đủ. */
export function fillTriangleSides(kind: TriangleKind, sides: TriangleSides, edited: keyof TriangleSides): TriangleSides {
  if (kind === 'equilateral') {
    const src = sides[edited] || sides.ab || sides.bc || sides.ca
    return { ab: src, bc: src, ca: src }
  }
  if (kind === 'isosceles') {
    if (edited === 'ca') return { ab: sides.ca, bc: sides.bc, ca: sides.ca }
    return { ab: sides.ab, bc: sides.bc, ca: sides.ab }
  }
  if (kind === 'right-isosceles') {
    const src = edited === 'bc' ? sides.bc : sides.ca || sides.bc
    const n = parseSideLength(src)
    return { ab: n == null ? '' : formatSideLength(n * Math.SQRT2), bc: src, ca: src }
  }
  if (kind === 'right') {
    const ca = parseSideLength(sides.ca)
    const bc = parseSideLength(sides.bc)
    if (ca == null || bc == null) return sides
    return { ...sides, ab: formatSideLength(Math.hypot(ca, bc)) }
  }
  return sides
}

export type TriangleSideError = 'missing' | 'inequality' | 'equilateral' | 'isosceles' | 'right' | 'right-isosceles'

export function triangleSideError(kind: TriangleKind, sides: TriangleSides): TriangleSideError | null {
  const ab = parseSideLength(sides.ab)
  const bc = parseSideLength(sides.bc)
  const ca = parseSideLength(sides.ca)
  if (ab == null || bc == null || ca == null) return 'missing'
  if (ab + bc <= ca + 1e-6 || ab + ca <= bc + 1e-6 || bc + ca <= ab + 1e-6) return 'inequality'
  if (kind === 'equilateral' && !(near(ab, bc) && near(bc, ca))) return 'equilateral'
  if (kind === 'isosceles' && !near(ab, ca)) return 'isosceles'
  if ((kind === 'right' || kind === 'right-isosceles') && !near(ab * ab, bc * bc + ca * ca)) return 'right'
  if (kind === 'right-isosceles' && !near(bc, ca)) return 'right-isosceles'
  return null
}

function centroidOf(pts: WhiteboardPoint[]): WhiteboardPoint {
  return {
    x: (pts[0].x + pts[1].x + pts[2].x) / 3,
    y: (pts[0].y + pts[1].y + pts[2].y) / 3,
  }
}

/**
 * Dựng ABC theo ba cạnh. Cạnh BC song song trục hoành.
 * Tam giác vuông (góc vuông tại C) cũng để cạnh BC nằm ngang, CA thẳng đứng.
 */
export function placeTriangle(mark: TriangleMark, sketch: WhiteboardPoint[]): WhiteboardPoint[] | null {
  if (sketch.length < 3) return null
  const ab = parseSideLength(mark.ab)
  const bc = parseSideLength(mark.bc)
  const ca = parseSideLength(mark.ca)
  if (ab == null || bc == null || ca == null) return null
  if (ab + bc <= ca || ab + ca <= bc || bc + ca <= ab) return null
  const sketchA = sketch[0]
  const sketchB = sketch[1]
  const sketchC = sketch[2]
  const side = (sketchC.x - sketchB.x) * (sketchA.y - sketchB.y) - (sketchC.y - sketchB.y) * (sketchA.x - sketchB.x)
  const ySign = side >= 0 ? 1 : -1
  const right = mark.kind === 'right' || mark.kind === 'right-isosceles'
  let idealA: WhiteboardPoint
  let idealB: WhiteboardPoint
  let idealC: WhiteboardPoint
  if (right) {
    idealB = { x: 0, y: 0 }
    idealC = { x: bc, y: 0 }
    idealA = { x: bc, y: ySign * ca }
  } else {
    idealB = { x: 0, y: 0 }
    idealC = { x: bc, y: 0 }
    const ax = (ab * ab + bc * bc - ca * ca) / (2 * bc)
    const ay2 = ab * ab - ax * ax
    if (ay2 < -1e-4) return null
    idealA = { x: ax, y: ySign * Math.sqrt(Math.max(0, ay2)) }
  }
  const ideal = [idealA, idealB, idealC]
  const from = centroidOf(ideal)
  const to = centroidOf(sketch)
  const sketchSize = Math.max(dist(sketchA, sketchB), dist(sketchB, sketchC), dist(sketchC, sketchA))
  const idealSize = Math.max(ab, bc, ca)
  const scale = idealSize > 1e-6 && sketchSize > 1 ? sketchSize / idealSize : 1
  return ideal.map((p) => ({
    x: to.x + (p.x - from.x) * scale,
    y: to.y + (p.y - from.y) * scale,
  }))
}
