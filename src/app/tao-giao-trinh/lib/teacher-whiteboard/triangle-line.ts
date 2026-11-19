import { dist, pointToSegment, segmentIntersection } from './geometry'
import { solidCornerIndices } from './solid'
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

export type StraightSeg = { a: WhiteboardPoint; b: WhiteboardPoint; color: string }

export function straightSegments(objects: WhiteboardObject[]): StraightSeg[] {
  const live = objects.map((obj) => resolveTriangleLine(obj, objects))
  const segs: StraightSeg[] = []
  for (const obj of live) {
    if (obj.kind !== 'shape' || obj.points.length < 2) continue
    if (obj.shape === 'triangle' && obj.regionOnly) continue
    if (obj.shape === 'triangle' && obj.points.length >= 3) {
      const p = obj.points
      segs.push(
        { a: p[0], b: p[1], color: obj.color },
        { a: p[1], b: p[2], color: obj.color },
        { a: p[2], b: p[0], color: obj.color },
      )
    } else if (obj.shape === 'line' || obj.triangleLine) {
      segs.push({ a: obj.points[0], b: obj.points[obj.points.length - 1], color: obj.color })
    } else if (obj.shape === 'arrow' && obj.points.length >= 2) {
      segs.push({ a: obj.points[0], b: obj.points[1], color: obj.color })
    }
  }
  return segs
}

/** Đỉnh tam giác và điểm giao đã đánh dấu bằng vòng tròn. */
export function markedPoints(objects: WhiteboardObject[]): WhiteboardPoint[] {
  const pts: WhiteboardPoint[] = []
  const push = (p: WhiteboardPoint) => {
    if (pts.some((q) => dist(q, p) < 4)) return
    pts.push(p)
  }
  for (const obj of objects) {
    if (obj.kind === 'shape' && obj.shape === 'triangle' && obj.points.length >= 3) {
      push(obj.points[0])
      push(obj.points[1])
      push(obj.points[2])
    }
    if (obj.kind === 'shape' && obj.shape === 'solid') {
      for (const index of solidCornerIndices(obj.points, obj.solidEdges ?? [], obj.solidCorners)) {
        const point = obj.points[index]
        if (point) push(point)
      }
    }
  }
  const segs = straightSegments(objects)
  for (let i = 0; i < segs.length; i += 1) {
    for (let j = i + 1; j < segs.length; j += 1) {
      const hit = segmentIntersection(segs[i].a, segs[i].b, segs[j].a, segs[j].b)
      if (hit) push(hit)
    }
  }
  return pts
}

export function nearestMarkedPoint(objects: WhiteboardObject[], p: WhiteboardPoint, thresh: number): WhiteboardPoint | null {
  let best: { point: WhiteboardPoint; d: number } | null = null
  for (const mark of markedPoints(objects)) {
    const d = dist(p, mark)
    if (d <= thresh && (!best || d < best.d)) best = { point: mark, d }
  }
  return best?.point ?? null
}

/**
 * Bút đã chạm điểm và kéo vượt qua. Giữ đầu nét tại điểm, bỏ đoạn thừa.
 * Kéo lùi hoặc lệch sang bên thì thả ra để vẽ tiếp.
 */
export function holdStrokeOnMark(
  points: WhiteboardPoint[],
  mark: WhiteboardPoint | null,
  world: WhiteboardPoint,
  thresh: number,
): { point: WhiteboardPoint; mark: WhiteboardPoint | null } {
  if (!mark || points.length === 0) return { point: world, mark: null }
  const prev = points.length >= 2 ? points[points.length - 2] : points[0]
  const vx = mark.x - prev.x
  const vy = mark.y - prev.y
  const len = Math.hypot(vx, vy) || 1
  const along = ((world.x - mark.x) * vx + (world.y - mark.y) * vy) / len
  const side = Math.abs((world.x - mark.x) * vy - (world.y - mark.y) * vx) / len
  if (side > thresh * 1.6 || along < -thresh) return { point: world, mark: null }
  return { point: mark, mark }
}

/**
 * Đưa đầu đoạn thẳng vào điểm đánh dấu nếu đầu nét nhằm trúng điểm
 * rồi lệch một đoạn ngắn (nét thẳng cắt qua điểm, hoặc số đo làm tròn đẩy đầu ra ngoài).
 */
export function pinLineEnds(
  start: WhiteboardPoint,
  end: WhiteboardPoint,
  objects: WhiteboardObject[],
  reach: number,
): [WhiteboardPoint, WhiteboardPoint] {
  const copy = (p: WhiteboardPoint): WhiteboardPoint => ({ x: p.x, y: p.y })
  const marks = markedPoints(objects)
  const dx = end.x - start.x
  const dy = end.y - start.y
  const span = Math.hypot(dx, dy)
  if (marks.length === 0 || span < 1 || reach <= 0) return [copy(start), copy(end)]
  const ux = dx / span
  const uy = dy / span
  const lateral = Math.max(8, Math.min(12, reach * 0.45))
  const pin = (at: number): WhiteboardPoint | null => {
    let best: WhiteboardPoint | null = null
    let bestD = reach
    for (const mark of marks) {
      const along = (mark.x - start.x) * ux + (mark.y - start.y) * uy
      const off = Math.abs((mark.x - start.x) * uy - (mark.y - start.y) * ux)
      if (off > lateral) continue
      if (Math.abs(along - at) > reach) continue
      if (at === 0 ? along > span * 0.5 : along < span * 0.5) continue
      const d = Math.hypot(along - at, off)
      if (d < bestD) {
        bestD = d
        best = mark
      }
    }
    return best
  }
  const a = pin(0) ?? start
  const b = pin(span) ?? end
  if (dist(a, b) < 4) return [copy(start), copy(end)]
  return [copy(a), copy(b)]
}

/** Cắt đoạn cuối nếu nét đã đi qua một điểm rồi thừa ra phía sau điểm đó. */
export function clipStrokeEndToMark(points: WhiteboardPoint[], objects: WhiteboardObject[], thresh: number): WhiteboardPoint[] {
  if (points.length < 2) return points
  const marks = markedPoints(objects)
  if (marks.length === 0) return points
  const end = points[points.length - 1]
  const start = points[0]
  const window = Math.max(thresh * 3, 36)
  let walked = 0
  let best: { mark: WhiteboardPoint; at: number; over: number } | null = null
  for (let i = points.length - 1; i >= 1 && walked <= window; i -= 1) {
    const a = points[i - 1]
    const b = points[i]
    walked += dist(a, b)
    for (const mark of marks) {
      if (dist(mark, start) <= thresh * 0.6) continue
      if (pointToSegment(mark, a, b) > thresh) continue
      const over = dist(mark, end)
      if (over < 1) return points
      if (!best || over < best.over) best = { mark, at: i, over }
    }
  }
  if (best && best.over <= window) {
    const cut = points.slice(0, best.at)
    cut.push({ x: best.mark.x, y: best.mark.y })
    return cut.length >= 2 ? cut : points
  }
  const pinned = pinLineEnds(start, end, objects, Math.max(thresh * 2.5, 40))
  if (dist(pinned[1], end) < 1) return points
  const dx = pinned[1].x - start.x
  const dy = pinned[1].y - start.y
  const span = Math.hypot(dx, dy) || 1
  const kept: WhiteboardPoint[] = []
  for (const p of points) {
    const along = ((p.x - start.x) * dx + (p.y - start.y) * dy) / span
    if (kept.length > 0 && along >= span - 0.5) break
    kept.push(p)
  }
  if (kept.length === 0) kept.push({ x: start.x, y: start.y })
  kept.push(pinned[1])
  return kept
}

function bary(p: WhiteboardPoint, a: WhiteboardPoint, b: WhiteboardPoint, c: WhiteboardPoint) {
  const v0x = b.x - a.x
  const v0y = b.y - a.y
  const v1x = c.x - a.x
  const v1y = c.y - a.y
  const v2x = p.x - a.x
  const v2y = p.y - a.y
  const den = v0x * v1y - v1x * v0y
  if (Math.abs(den) < 1e-8) return null
  const u = (v2x * v1y - v1x * v2y) / den
  const v = (v0x * v2y - v2x * v0y) / den
  return { u, v, w: 1 - u - v }
}

function strictInside(p: WhiteboardPoint, pts: WhiteboardPoint[]): boolean {
  const hit = bary(p, pts[0], pts[1], pts[2])
  return !!hit && hit.u > 1e-3 && hit.v > 1e-3 && hit.w > 1e-3
}

function triangleArea(pts: WhiteboardPoint[]): number {
  return Math.abs((pts[1].x - pts[0].x) * (pts[2].y - pts[0].y) - (pts[2].x - pts[0].x) * (pts[1].y - pts[0].y)) / 2
}

function vertexForEntered(pts: WhiteboardPoint[], from: WhiteboardPoint, into: WhiteboardPoint, thresh: number): 0 | 1 | 2 {
  let nearest: { i: 0 | 1 | 2; d: number } | null = null
  for (let i = 0; i < 3; i += 1) {
    const d = dist(from, pts[i])
    if (!nearest || d < nearest.d) nearest = { i: i as 0 | 1 | 2, d }
  }
  if (nearest && nearest.d <= thresh) return nearest.i
  for (let i = 0; i < 3; i += 1) {
    const a = pts[i]
    const b = pts[(i + 1) % 3]
    const abx = b.x - a.x
    const aby = b.y - a.y
    const len2 = abx * abx + aby * aby || 1
    const t = ((from.x - a.x) * abx + (from.y - a.y) * aby) / len2
    if (t < -0.05 || t > 1.05) continue
    const q = { x: a.x + abx * Math.min(1, Math.max(0, t)), y: a.y + aby * Math.min(1, Math.max(0, t)) }
    if (dist(from, q) <= thresh) return ((i + 2) % 3) as 0 | 1 | 2
  }
  let best: 0 | 1 | 2 = 0
  let bestD = Infinity
  for (let i = 0; i < 3; i += 1) {
    const d = dist(into, pts[i])
    if (d < bestD) {
      bestD = d
      best = i as 0 | 1 | 2
    }
  }
  return best
}

/**
 * Nét thẳng đi từ điểm đánh dấu vào lòng một tam giác thì hỏi đường của tam giác đó.
 * Hai tam giác chung một điểm: kéo vào tam giác nào thì hỏi tam giác đó.
 */
export type TriangleStrokeTarget = {
  triangleId: string
  vertex: 0 | 1 | 2
  point: WhiteboardPoint
  points: WhiteboardPoint[]
  vertexNames: [string, string, string]
}

function describeTriangleHit(
  pool: WhiteboardObject[],
  hit: { triangleId: string; vertex: 0 | 1 | 2; point: WhiteboardPoint },
): TriangleStrokeTarget {
  const tri = pool.find((item) => item.kind === 'shape' && item.id === hit.triangleId)
  const names = tri && tri.kind === 'shape' && tri.vertexNames ? tri.vertexNames : ['A', 'B', 'C'] as [string, string, string]
  const points = tri && tri.kind === 'shape' ? tri.points.slice(0, 3) : [hit.point]
  return { triangleId: hit.triangleId, vertex: hit.vertex, point: hit.point, points, vertexNames: names }
}

export function triangleForStraightStroke(
  objects: WhiteboardObject[],
  points: WhiteboardPoint[],
  thresh: number,
): TriangleStrokeTarget | null {
  if (points.length < 2) return null
  const start = points[0]
  const end = points[points.length - 1]
  const startMark = nearestMarkedPoint(objects, start, thresh)
  const endMark = nearestMarkedPoint(objects, end, thresh)
  const from = startMark ?? endMark
  const pool = [...objects, ...derivedTriangles(objects)]
  const fallback = () => {
    const hit = nearestTriangleVertex(objects, start, thresh) ?? nearestTriangleVertex(objects, end, thresh)
    return hit ? describeTriangleHit(pool, hit) : null
  }
  if (!from) return fallback()
  const into = startMark && !endMark ? end : endMark && !startMark ? start : end
  const probe = { x: from.x + (into.x - from.x) * 0.65, y: from.y + (into.y - from.y) * 0.65 }
  const tris = pool.filter((obj) => obj.kind === 'shape' && obj.shape === 'triangle' && obj.points.length >= 3)
  const entered = tris.filter((obj) => obj.kind === 'shape' && (strictInside(into, obj.points) || strictInside(probe, obj.points)))
  if (entered.length === 0) return fallback()
  entered.sort((a, b) => {
    if (a.kind !== 'shape' || b.kind !== 'shape') return 0
    return triangleArea(a.points) - triangleArea(b.points)
  })
  const tri = entered[0]
  if (tri.kind !== 'shape') return null
  return describeTriangleHit(pool, {
    triangleId: tri.id,
    vertex: vertexForEntered(tri.points, from, into, thresh),
    point: from,
  })
}

export function nearestTriangleVertex(
  objects: WhiteboardObject[],
  p: WhiteboardPoint,
  thresh: number,
): { triangleId: string; vertex: 0 | 1 | 2; point: WhiteboardPoint } | null {
  let best: { triangleId: string; vertex: 0 | 1 | 2; point: WhiteboardPoint; d: number } | null = null
  for (const obj of objects) {
    if (obj.kind !== 'shape' || obj.shape !== 'triangle' || obj.regionOnly || obj.points.length < 3) continue
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
  const id = obj.triangleLine.triangleId
  const tri = objects.find((item) => item.kind === 'shape' && item.shape === 'triangle' && item.id === id)
    ?? derivedTriangles(objects).find((item) => item.kind === 'shape' && item.id === id)
  if (!tri || tri.kind !== 'shape' || tri.points.length < 3) return obj
  const pts = triangleLinePoints(obj.triangleLine.role, obj.triangleLine.vertex, tri.points)
  if (!pts) return obj
  return { ...obj, points: pts }
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export function usedVertexNames(objects: WhiteboardObject[]): Set<string> {
  const used = new Set<string>()
  let unlabeled = false
  for (const obj of objects) {
    if (obj.kind !== 'shape' || obj.shape !== 'triangle') continue
    if (obj.vertexNames && obj.vertexNames.length === 3) {
      for (const name of obj.vertexNames) if (name) used.add(name)
    } else if (!obj.regionOnly) unlabeled = true
  }
  if (unlabeled) {
    used.add('A')
    used.add('B')
    used.add('C')
  }
  for (const obj of objects) {
    if (obj.kind !== 'shape' || !obj.quadNames) continue
    for (const name of obj.quadNames) if (name) used.add(name)
  }
  return used
}

export function nextVertexName(used: Set<string>): string {
  for (const ch of LETTERS) {
    if (!used.has(ch)) return ch
  }
  for (let n = 1; n < 100; n += 1) {
    const name = `P${n}`
    if (!used.has(name)) return name
  }
  return 'Z9'
}

function onOpenEdge(p: WhiteboardPoint, a: WhiteboardPoint, b: WhiteboardPoint): boolean {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const len2 = abx * abx + aby * aby
  if (len2 < 1) return false
  const t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2
  if (t <= 0.04 || t >= 0.96) return false
  const q = { x: a.x + abx * t, y: a.y + aby * t }
  return dist(p, q) <= 2
}

/** Tam giác con sinh ra khi đường cao, phân giác hoặc trung tuyến cắt cạnh đối diện. */
export function derivedTriangles(objects: WhiteboardObject[]): WhiteboardObject[] {
  const regions: WhiteboardObject[] = []
  const used = usedVertexNames(objects)
  const pool = () => [
    ...objects.filter((item) => item.kind === 'shape' && item.shape === 'triangle'),
    ...regions,
  ]
  const lines = objects.filter((item) => (
    item.kind === 'shape'
    && item.triangleLine
    && (item.triangleLine.role === 'altitude' || item.triangleLine.role === 'bisector' || item.triangleLine.role === 'median')
  ))
  let pending = lines
  for (let guard = 0; guard < 6 && pending.length > 0; guard += 1) {
    const next: typeof pending = []
    for (const line of pending) {
      if (line.kind !== 'shape' || !line.triangleLine) continue
      const tri = pool().find((item) => item.kind === 'shape' && item.id === line.triangleLine?.triangleId)
      if (!tri || tri.kind !== 'shape' || tri.points.length < 3) {
        next.push(line)
        continue
      }
      const vertex = line.triangleLine.vertex
      const built = triangleLinePoints(line.triangleLine.role, vertex, tri.points)
      if (!built) continue
      const foot = built[1]
      const p = tri.points[(vertex + 1) % 3]
      const q = tri.points[(vertex + 2) % 3]
      if (!onOpenEdge(foot, p, q)) continue
      const names = tri.vertexNames ?? (['A', 'B', 'C'] as [string, string, string])
      let footName = line.triangleLine.footName
      if (!footName || used.has(footName)) footName = nextVertexName(used)
      used.add(footName)
      const v = tri.points[vertex]
      const base = {
        kind: 'shape' as const,
        shape: 'triangle' as const,
        color: tri.color,
        size: tri.size,
        regionOnly: true,
      }
      regions.push({
        ...base,
        id: `region:${line.id}:0`,
        points: [v, p, foot],
        vertexNames: [names[vertex] || 'A', names[(vertex + 1) % 3] || 'B', footName],
      })
      regions.push({
        ...base,
        id: `region:${line.id}:1`,
        points: [v, foot, q],
        vertexNames: [names[vertex] || 'A', footName, names[(vertex + 2) % 3] || 'C'],
      })
    }
    if (next.length === pending.length) break
    pending = next
  }
  return regions
}

export function reservedVertexNames(objects: WhiteboardObject[]): Set<string> {
  const used = usedVertexNames(objects)
  for (const region of derivedTriangles(objects)) {
    if (region.kind === 'shape' && region.vertexNames) {
      for (const name of region.vertexNames) used.add(name)
    }
  }
  return used
}

export function freshVertexNames(objects: WhiteboardObject[]): [string, string, string] {
  return freshCornerNames(objects, 3) as [string, string, string]
}

export function freshCornerNames(objects: WhiteboardObject[], count: number): string[] {
  const used = reservedVertexNames(objects)
  const names: string[] = []
  for (let i = 0; i < count; i += 1) {
    const name = nextVertexName(used)
    names.push(name)
    used.add(name)
  }
  return names
}

/** Tên điểm mới khi đường từ đỉnh cắt cạnh đối diện, không trùng A, B, C hay điểm đã có. */
export function footNameForNewPoint(
  objects: WhiteboardObject[],
  role: TriangleLineRole,
  vertex: 0 | 1 | 2,
  triPts: WhiteboardPoint[],
  foot: WhiteboardPoint,
): string | undefined {
  if (role !== 'altitude' && role !== 'bisector' && role !== 'median') return undefined
  if (triPts.length < 3) return undefined
  const p = triPts[(vertex + 1) % 3]
  const q = triPts[(vertex + 2) % 3]
  if (!onOpenEdge(foot, p, q)) return undefined
  return nextVertexName(reservedVertexNames(objects))
}

export const TRIANGLE_LINE_ROLES: TriangleLineRole[] = ['altitude', 'bisector', 'median', 'perp-bisector', 'midsegment']
