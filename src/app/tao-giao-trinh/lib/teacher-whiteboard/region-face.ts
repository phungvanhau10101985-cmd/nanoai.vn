import { dist, pathLength, pointToSegment, simplifyRdp } from './geometry'
import { pointInPolygon, polygonArea } from './fill-region'
import type { WhiteboardObject, WhiteboardPoint, WhiteboardShape } from './types'

const JOIN = 14

type Seg = { a: WhiteboardPoint; b: WhiteboardPoint; cuts: number[] }

function pushSeg(segs: Seg[], a: WhiteboardPoint, b: WhiteboardPoint) {
  if (dist(a, b) < 1.5) return
  segs.push({ a, b, cuts: [0, 1] })
}

function addChain(segs: Seg[], pts: WhiteboardPoint[], closed: boolean) {
  for (let i = 1; i < pts.length; i += 1) pushSeg(segs, pts[i - 1], pts[i])
  if (closed && pts.length >= 3) pushSeg(segs, pts[pts.length - 1], pts[0])
}

function strokeChain(stroke: { points: WhiteboardPoint[] }): WhiteboardPoint[] {
  const simple = simplifyRdp(stroke.points, 3)
  if (simple.length < 2) return simple
  const chord = dist(simple[0], simple[simple.length - 1])
  if (chord >= 12 && pathLength(simple) < chord * 1.22) return [simple[0], simple[simple.length - 1]]
  return simple
}

function collectSegments(objects: WhiteboardObject[]): Seg[] {
  const segs: Seg[] = []
  for (const obj of objects) {
    if (obj.kind === 'stroke') {
      if (obj.tool === 'eraser' || obj.points.length < 2) continue
      addChain(segs, strokeChain(obj), false)
      continue
    }
    if (obj.kind !== 'shape' || obj.fillOnly || obj.regionOnly || obj.shape === 'solid' || obj.points.length < 2) continue
    if (obj.shape === 'line' || obj.shape === 'arrow') {
      addChain(segs, obj.shape === 'arrow' ? obj.points.slice(0, 2) : obj.points, false)
      continue
    }
    if (obj.shape === 'rect' && obj.points.length >= 2) {
      const a = obj.points[0]
      const b = obj.points[1]
      const p0 = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) }
      const p1 = { x: Math.max(a.x, b.x), y: Math.min(a.y, b.y) }
      const p2 = { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y) }
      const p3 = { x: Math.min(a.x, b.x), y: Math.max(a.y, b.y) }
      addChain(segs, [p0, p1, p2, p3], true)
      continue
    }
    if (obj.shape === 'triangle' || obj.shape === 'polygon') addChain(segs, obj.points, true)
  }
  return segs.length > 700 ? segs.slice(0, 700) : segs
}

function cutAt(a: WhiteboardPoint, b: WhiteboardPoint, c: WhiteboardPoint, d: WhiteboardPoint): { t: number; u: number } | null {
  const rx = b.x - a.x
  const ry = b.y - a.y
  const qx = d.x - c.x
  const qy = d.y - c.y
  const den = rx * qy - ry * qx
  if (Math.abs(den) < 1e-8) return null
  const t = ((c.x - a.x) * qy - (c.y - a.y) * qx) / den
  const u = ((c.x - a.x) * ry - (c.y - a.y) * rx) / den
  if (t < -0.002 || t > 1.002 || u < -0.002 || u > 1.002) return null
  return { t: Math.min(1, Math.max(0, t)), u: Math.min(1, Math.max(0, u)) }
}

function projectT(p: WhiteboardPoint, a: WhiteboardPoint, b: WhiteboardPoint): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  if (len2 < 1e-8) return 0
  return ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2
}

function pointAt(seg: Seg, t: number): WhiteboardPoint {
  return { x: seg.a.x + (seg.b.x - seg.a.x) * t, y: seg.a.y + (seg.b.y - seg.a.y) * t }
}

function splitSegments(segs: Seg[]): Array<[WhiteboardPoint, WhiteboardPoint]> {
  const bridges: Array<[WhiteboardPoint, WhiteboardPoint]> = []
  for (let i = 0; i < segs.length; i += 1) {
    for (let j = i + 1; j < segs.length; j += 1) {
      const hit = cutAt(segs[i].a, segs[i].b, segs[j].a, segs[j].b)
      if (!hit) continue
      segs[i].cuts.push(hit.t)
      segs[j].cuts.push(hit.u)
    }
  }
  for (let i = 0; i < segs.length; i += 1) {
    const ends = [segs[i].a, segs[i].b]
    for (const end of ends) {
      for (let j = 0; j < segs.length; j += 1) {
        if (i === j) continue
        const gap = pointToSegment(end, segs[j].a, segs[j].b)
        if (gap < 0.6 || gap > JOIN) continue
        const t = projectT(end, segs[j].a, segs[j].b)
        if (t < -0.02 || t > 1.02) continue
        const clamped = Math.min(1, Math.max(0, t))
        segs[j].cuts.push(clamped)
        bridges.push([end, pointAt(segs[j], clamped)])
      }
    }
  }
  const edges: Array<[WhiteboardPoint, WhiteboardPoint]> = []
  for (const seg of segs) {
    const cuts = seg.cuts.filter((t) => t >= 0 && t <= 1).sort((a, b) => a - b)
    let prev = cuts[0] ?? 0
    for (let i = 1; i < cuts.length; i += 1) {
      if (cuts[i] - prev < 1e-4) continue
      const a = pointAt(seg, prev)
      const b = pointAt(seg, cuts[i])
      if (dist(a, b) >= 0.6) edges.push([a, b])
      prev = cuts[i]
    }
  }
  for (const [a, b] of bridges) {
    if (dist(a, b) >= 0.6) edges.push([a, b])
  }
  return edges
}

/** Đa giác của miền kín chứa điểm. Nhiều đường thẳng cắt nhau vẫn thành một miền. */
export function closedFaceAt(objects: WhiteboardObject[], p: WhiteboardPoint): WhiteboardPoint[] | null {
  const edges = splitSegments(collectSegments(objects))
  if (edges.length < 3) return null
  const nodes: WhiteboardPoint[] = []
  const index = new Map<string, number>()
  const idOf = (q: WhiteboardPoint) => {
    const key = `${Math.round(q.x * 2)}:${Math.round(q.y * 2)}`
    const found = index.get(key)
    if (found != null) return found
    const id = nodes.length
    nodes.push(q)
    index.set(key, id)
    return id
  }
  const out: Array<Array<{ to: number; ang: number }>> = []
  const ensure = (id: number) => {
    while (out.length <= id) out.push([])
  }
  const seen = new Set<string>()
  const unique: Array<[number, number]> = []
  for (const [a, b] of edges) {
    const ia = idOf(a)
    const ib = idOf(b)
    if (ia === ib) continue
    const key = ia < ib ? `${ia}-${ib}` : `${ib}-${ia}`
    if (seen.has(key)) continue
    seen.add(key)
    ensure(ia)
    ensure(ib)
    out[ia].push({ to: ib, ang: Math.atan2(nodes[ib].y - nodes[ia].y, nodes[ib].x - nodes[ia].x) })
    out[ib].push({ to: ia, ang: Math.atan2(nodes[ia].y - nodes[ib].y, nodes[ia].x - nodes[ib].x) })
    unique.push([ia, ib])
  }
  for (const list of out) list.sort((a, b) => a.ang - b.ang)
  let best: [number, number] | null = null
  let bestX = Infinity
  for (const [ia, ib] of unique) {
    const a = nodes[ia]
    const b = nodes[ib]
    if ((a.y > p.y) === (b.y > p.y)) continue
    const t = (p.y - a.y) / (b.y - a.y)
    if (t < -1e-4 || t > 1 + 1e-4) continue
    const x = a.x + t * (b.x - a.x)
    if (x < p.x - 0.4 || x >= bestX) continue
    best = [ia, ib]
    bestX = x
  }
  if (!best) return null
  const a = nodes[best[0]]
  const b = nodes[best[1]]
  const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)
  if (Math.abs(cross) < 1e-3) return null
  let from = cross > 0 ? best[0] : best[1]
  let to = cross > 0 ? best[1] : best[0]
  const startFrom = from
  const startTo = to
  const poly: WhiteboardPoint[] = [nodes[from]]
  for (let step = 0; step <= unique.length + 1; step += 1) {
    const list = out[to] ?? []
    if (list.length === 0) return null
    const back = list.findIndex((edge) => edge.to === from)
    const idx = back >= 0 ? back : 0
    const nxt = list[(idx - 1 + list.length) % list.length]
    poly.push(nodes[to])
    from = to
    to = nxt.to
    if (from === startFrom && to === startTo) break
  }
  if (from !== startFrom || to !== startTo) return null
  const ring: WhiteboardPoint[] = []
  for (const q of poly) {
    const last = ring[ring.length - 1]
    if (last && dist(last, q) < 0.6) continue
    ring.push(q)
  }
  if (ring.length >= 2 && dist(ring[0], ring[ring.length - 1]) < 0.6) ring.pop()
  if (ring.length < 3 || polygonArea(ring) < 36) return null
  if (!pointInPolygon(p, ring)) return null
  return ring
}

/** Vùng tô ghép sẵn nhỏ nhất đang chứa điểm. */
export function smallestFillPocket(objects: WhiteboardObject[], p: WhiteboardPoint): WhiteboardShape | null {
  let best: WhiteboardShape | null = null
  let bestArea = Infinity
  for (const obj of objects) {
    if (obj.kind !== 'shape' || !obj.fillOnly || obj.points.length < 3) continue
    if (!pointInPolygon(p, obj.points)) continue
    const area = polygonArea(obj.points)
    if (area < bestArea) {
      best = obj
      bestArea = area
    }
  }
  return best
}
