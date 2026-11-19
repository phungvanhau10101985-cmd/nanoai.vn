import { dist, pathLength } from './geometry'
import type { WhiteboardObject, WhiteboardPoint, WhiteboardShape, WhiteboardStroke } from './types'

export function pointInPolygon(p: WhiteboardPoint, pts: WhiteboardPoint[]): boolean {
  if (pts.length < 3) return false
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
    const a = pts[i]
    const b = pts[j]
    const cross = (a.y > p.y) !== (b.y > p.y)
    if (!cross) continue
    const x = ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    if (p.x < x) inside = !inside
  }
  return inside
}

export function polygonArea(pts: WhiteboardPoint[]): number {
  let area = 0
  for (let i = 0; i < pts.length; i += 1) {
    const p = pts[i]
    const q = pts[(i + 1) % pts.length]
    area += p.x * q.y - q.x * p.y
  }
  return Math.abs(area) / 2
}

export function strokeIsClosed(stroke: WhiteboardStroke): boolean {
  if (stroke.tool === 'eraser' || stroke.points.length < 8) return false
  const len = pathLength(stroke.points)
  if (len < 48) return false
  const gap = dist(stroke.points[0], stroke.points[stroke.points.length - 1])
  if (gap > Math.max(28, len * 0.18)) return false
  return polygonArea(stroke.points) >= 200
}

function insideShape(obj: WhiteboardShape, p: WhiteboardPoint): boolean {
  if (obj.triangleLine) return false
  if (obj.shape === 'circle' && obj.cx != null && obj.cy != null && obj.r != null) {
    return Math.hypot(p.x - obj.cx, p.y - obj.cy) <= obj.r
  }
  if (obj.shape === 'ellipse' && obj.cx != null && obj.cy != null && obj.rx != null && obj.ry != null) {
    const rot = -(obj.rotation ?? 0)
    const c = Math.cos(rot)
    const s = Math.sin(rot)
    const dx = p.x - obj.cx
    const dy = p.y - obj.cy
    const lx = (dx * c - dy * s) / obj.rx
    const ly = (dx * s + dy * c) / obj.ry
    return lx * lx + ly * ly <= 1
  }
  if (obj.shape === 'rect' && obj.points.length >= 2) {
    const a = obj.points[0]
    const b = obj.points[1]
    const minX = Math.min(a.x, b.x)
    const maxX = Math.max(a.x, b.x)
    const minY = Math.min(a.y, b.y)
    const maxY = Math.max(a.y, b.y)
    return p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY
  }
  if ((obj.shape === 'triangle' || obj.shape === 'polygon') && obj.points.length >= 3) {
    return pointInPolygon(p, obj.points)
  }
  return false
}

/** Vùng khép kín trên cùng chứa điểm. Nét hở, mũi tên và đường thẳng không tính. */
export function topClosedRegion(objects: WhiteboardObject[], p: WhiteboardPoint): WhiteboardObject | null {
  for (let i = objects.length - 1; i >= 0; i -= 1) {
    const obj = objects[i]
    if (obj.kind === 'shape' && insideShape(obj, p)) return obj
    if (obj.kind === 'stroke' && strokeIsClosed(obj) && pointInPolygon(p, obj.points)) return obj
  }
  return null
}

export function isFillableObject(obj: WhiteboardObject): boolean {
  if (obj.kind === 'stroke') return strokeIsClosed(obj)
  if (obj.kind !== 'shape' || obj.triangleLine) return false
  return obj.shape === 'circle' || obj.shape === 'ellipse' || obj.shape === 'rect' || obj.shape === 'triangle' || obj.shape === 'polygon'
}
