import { dist } from './geometry'
import type { TriangleLineRole, WhiteboardObject, WhiteboardPoint } from './types'

const NAMES = ['A', 'B', 'C'] as const

export function triangleVertexName(vertex: 0 | 1 | 2): string {
  return NAMES[vertex]
}

export function oppositeEdge(vertex: 0 | 1 | 2, pts: WhiteboardPoint[]): [WhiteboardPoint, WhiteboardPoint] {
  return [pts[(vertex + 1) % 3], pts[(vertex + 2) % 3]]
}

export function midpoint(a: WhiteboardPoint, b: WhiteboardPoint): WhiteboardPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function foot(p: WhiteboardPoint, a: WhiteboardPoint, b: WhiteboardPoint): WhiteboardPoint {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const len2 = abx * abx + aby * aby || 1
  const t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2
  return { x: a.x + abx * t, y: a.y + aby * t }
}

export function triangleLinePoints(role: TriangleLineRole, vertex: 0 | 1 | 2, pts: WhiteboardPoint[]): [WhiteboardPoint, WhiteboardPoint] | null {
  if (pts.length < 3) return null
  const v = pts[vertex]
  const [p, q] = oppositeEdge(vertex, pts)
  if (role === 'altitude') return [v, foot(v, p, q)]
  if (role === 'median') return [v, midpoint(p, q)]
  if (role === 'bisector') {
    const vp = dist(v, p)
    const vq = dist(v, q)
    const sum = vp + vq || 1
    return [v, { x: (vq * p.x + vp * q.x) / sum, y: (vq * p.y + vp * q.y) / sum }]
  }
  if (role === 'perp-bisector') {
    const mid = midpoint(p, q)
    const dx = q.x - p.x
    const dy = q.y - p.y
    const len = Math.hypot(dx, dy) || 1
    const nx = -dy / len
    const ny = dx / len
    const half = len * 0.7
    return [
      { x: mid.x - nx * half, y: mid.y - ny * half },
      { x: mid.x + nx * half, y: mid.y + ny * half },
    ]
  }
  return [midpoint(v, p), midpoint(v, q)]
}

export function nearestTriangleVertex(
  objects: WhiteboardObject[],
  p: WhiteboardPoint,
  thresh: number,
): { triangleId: string; vertex: 0 | 1 | 2; point: WhiteboardPoint } | null {
  let best: { triangleId: string; vertex: 0 | 1 | 2; point: WhiteboardPoint; d: number } | null = null
  for (const obj of objects) {
    if (obj.kind !== 'shape' || obj.shape !== 'triangle' || obj.points.length < 3) continue
    for (let i = 0; i < 3; i += 1) {
      const vertex = i as 0 | 1 | 2
      const d = dist(p, obj.points[i])
      if (d <= thresh && (!best || d < best.d)) {
        best = { triangleId: obj.id, vertex, point: obj.points[i], d }
      }
    }
  }
  if (!best) return null
  return { triangleId: best.triangleId, vertex: best.vertex, point: best.point }
}

export function resolveTriangleLine(obj: WhiteboardObject, objects: WhiteboardObject[]): WhiteboardObject {
  if (obj.kind !== 'shape' || !obj.triangleLine || obj.points.length < 2) return obj
  const tri = objects.find((item) => item.kind === 'shape' && item.shape === 'triangle' && item.id === obj.triangleLine?.triangleId)
  if (!tri || tri.kind !== 'shape' || tri.points.length < 3) return obj
  const pts = triangleLinePoints(obj.triangleLine.role, obj.triangleLine.vertex, tri.points)
  if (!pts) return obj
  return { ...obj, points: pts }
}

export const TRIANGLE_LINE_ROLES: TriangleLineRole[] = ['altitude', 'bisector', 'median', 'perp-bisector', 'midsegment']
