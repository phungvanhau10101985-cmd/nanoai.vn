import { dist, pointToSegment, rotateAround, scaleAround, translatePoint } from './geometry'
import type {
  WhiteboardCamera,
  WhiteboardDraft,
  WhiteboardGraph,
  WhiteboardObject,
  WhiteboardPoint,
  WhiteboardShape,
  WhiteboardState,
  WhiteboardStroke,
  WhiteboardWireMessage,
} from './types'
import { DEFAULT_WHITEBOARD_CAMERA, WHITEBOARD_MAX_OBJECTS, WHITEBOARD_MAX_POINTS } from './types'

function num(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function point(raw: unknown): WhiteboardPoint | null {
  if (!raw || typeof raw !== 'object') return null
  const p = raw as { x?: unknown; y?: unknown }
  const x = num(p.x, NaN)
  const y = num(p.y, NaN)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  return { x, y }
}

function points(raw: unknown, cap = WHITEBOARD_MAX_POINTS): WhiteboardPoint[] {
  if (!Array.isArray(raw)) return []
  const out: WhiteboardPoint[] = []
  for (const item of raw) {
    const p = point(item)
    if (!p) continue
    out.push(p)
    if (out.length >= cap) break
  }
  return out
}

function colorOf(raw: unknown): string {
  const s = typeof raw === 'string' ? raw.trim() : ''
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s : '#111827'
}

export function sanitizeWhiteboardObject(raw: unknown): WhiteboardObject | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const id = typeof o.id === 'string' && o.id.trim() ? o.id.trim().slice(0, 80) : null
  if (!id) return null
  const color = colorOf(o.color)
  const size = Math.max(1, Math.min(16, num(o.size, 3)))
  if (o.kind === 'stroke') {
    const pts = points(o.points)
    if (pts.length < 1) return null
    return { kind: 'stroke', id, tool: o.tool === 'eraser' ? 'eraser' : 'pen', color, size, points: pts }
  }
  if (o.kind === 'shape') {
    const shape = o.shape
    if (
      shape !== 'line' &&
      shape !== 'arrow' &&
      shape !== 'circle' &&
      shape !== 'ellipse' &&
      shape !== 'rect' &&
      shape !== 'triangle' &&
      shape !== 'polygon'
    ) return null
    const next: WhiteboardShape = {
      kind: 'shape',
      id,
      shape,
      color,
      size,
      points: points(o.points, 24),
    }
    if (typeof o.cx === 'number') next.cx = num(o.cx)
    if (typeof o.cy === 'number') next.cy = num(o.cy)
    if (typeof o.r === 'number') next.r = Math.max(1, num(o.r))
    if (typeof o.rx === 'number') next.rx = Math.max(1, num(o.rx))
    if (typeof o.ry === 'number') next.ry = Math.max(1, num(o.ry))
    if (typeof o.rotation === 'number') next.rotation = num(o.rotation)
    const tri = o.triangle
    if (shape === 'triangle' && tri && typeof tri === 'object') {
      const mark = tri as Record<string, unknown>
      const kind = mark.kind
      const clip = (value: unknown) => typeof value === 'string' ? value.trim().slice(0, 24) : ''
      if (kind === 'equilateral' || kind === 'isosceles' || kind === 'right' || kind === 'right-isosceles' || kind === 'scalene') {
        next.triangle = { kind, ab: clip(mark.ab), bc: clip(mark.bc), ca: clip(mark.ca) }
      }
    }
    const line = o.triangleLine
    if (line && typeof line === 'object') {
      const mark = line as Record<string, unknown>
      const role = mark.role
      const vertex = mark.vertex
      const triangleId = typeof mark.triangleId === 'string' ? mark.triangleId.trim().slice(0, 80) : ''
      if (
        triangleId &&
        (vertex === 0 || vertex === 1 || vertex === 2) &&
        (role === 'altitude' || role === 'bisector' || role === 'median' || role === 'perp-bisector' || role === 'midsegment')
      ) {
        next.triangleLine = { role, vertex, triangleId }
      }
    }
    return next
  }
  if (o.kind === 'graph') {
    const expr = typeof o.expr === 'string' ? o.expr.trim().slice(0, 180) : ''
    if (!expr) return null
    const origin = point(o.origin) ?? { x: 0, y: 0 }
    const axis = o.axis === 'x' ? 'x' : 'y'
    const frameId = typeof o.frameId === 'string' && o.frameId.trim() ? o.frameId.trim().slice(0, 80) : undefined
    return {
      kind: 'graph',
      id,
      color,
      axis,
      expr,
      origin,
      unit: Math.max(8, Math.min(160, num(o.unit, 40))),
      ...(frameId ? { frameId } : {}),
    }
  }
  return null
}

export function sanitizeWhiteboardCamera(raw: unknown): WhiteboardCamera {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_WHITEBOARD_CAMERA }
  const c = raw as Record<string, unknown>
  const scale = Math.max(0.25, Math.min(4, num(c.scale, 1)))
  return { x: num(c.x), y: num(c.y), scale }
}

export function sanitizeWhiteboardDraft(raw: unknown): WhiteboardDraft | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const id = typeof o.id === 'string' ? o.id : ''
  const pts = points(o.points)
  if (!id || pts.length < 1) return null
  return {
    id,
    tool: o.tool === 'eraser' ? 'eraser' : 'pen',
    color: colorOf(o.color),
    size: Math.max(1, Math.min(16, num(o.size, 3))),
    points: pts,
  }
}

export function sanitizeWhiteboardObjects(raw: unknown): WhiteboardObject[] {
  if (!Array.isArray(raw)) return []
  const out: WhiteboardObject[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    const obj = sanitizeWhiteboardObject(item)
    if (!obj || seen.has(obj.id)) continue
    seen.add(obj.id)
    out.push(obj)
    if (out.length >= WHITEBOARD_MAX_OBJECTS) break
  }
  return out
}

export function emptyWhiteboardState(): WhiteboardState {
  return {
    objects: [],
    camera: { ...DEFAULT_WHITEBOARD_CAMERA },
    draft: null,
    grid: true,
    ortho: false,
  }
}

export function upsertWhiteboardObject(objects: WhiteboardObject[], object: WhiteboardObject): WhiteboardObject[] {
  const idx = objects.findIndex((item) => item.id === object.id)
  if (idx < 0) {
    const next = [...objects, object]
    return next.length > WHITEBOARD_MAX_OBJECTS ? next.slice(next.length - WHITEBOARD_MAX_OBJECTS) : next
  }
  const next = objects.slice()
  next[idx] = object
  return next
}

export function objectPoints(obj: WhiteboardObject): WhiteboardPoint[] {
  if (obj.kind === 'stroke') return obj.points
  if (obj.kind === 'graph') {
    const u = obj.unit
    return [
      obj.origin,
      { x: obj.origin.x + u, y: obj.origin.y },
      { x: obj.origin.x, y: obj.origin.y - u },
    ]
  }
  if (obj.shape === 'circle' && obj.cx != null && obj.cy != null && obj.r != null) {
    return [
      { x: obj.cx, y: obj.cy },
      { x: obj.cx + obj.r, y: obj.cy },
      { x: obj.cx, y: obj.cy + obj.r },
    ]
  }
  if (obj.shape === 'ellipse' && obj.cx != null && obj.cy != null && obj.rx != null && obj.ry != null) {
    return [
      { x: obj.cx, y: obj.cy },
      { x: obj.cx + obj.rx, y: obj.cy },
      { x: obj.cx, y: obj.cy + obj.ry },
    ]
  }
  return obj.points
}

export type WorldBox = { minX: number; minY: number; maxX: number; maxY: number }

function boxOfPoints(pts: WhiteboardPoint[], pad = 0): WorldBox | null {
  if (pts.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of pts) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad }
}

export function objectWorldBounds(obj: WhiteboardObject): WorldBox | null {
  if (obj.kind === 'graph') {
    const u = obj.unit * 8
    return { minX: obj.origin.x - u, minY: obj.origin.y - u, maxX: obj.origin.x + u, maxY: obj.origin.y + u }
  }
  if (obj.kind === 'shape' && obj.shape === 'circle' && obj.cx != null && obj.cy != null && obj.r != null) {
    return { minX: obj.cx - obj.r, minY: obj.cy - obj.r, maxX: obj.cx + obj.r, maxY: obj.cy + obj.r }
  }
  if (obj.kind === 'shape' && obj.shape === 'ellipse' && obj.cx != null && obj.cy != null && obj.rx != null && obj.ry != null) {
    const r = Math.hypot(obj.rx, obj.ry)
    return { minX: obj.cx - r, minY: obj.cy - r, maxX: obj.cx + r, maxY: obj.cy + r }
  }
  return boxOfPoints(objectPoints(obj), obj.kind === 'stroke' ? obj.size : 0)
}

function boxesOverlap(a: WorldBox, b: WorldBox): boolean {
  return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY)
}

function boxInside(inner: WorldBox, outer: WorldBox): boolean {
  return inner.minX >= outer.minX && inner.maxX <= outer.maxX && inner.minY >= outer.minY && inner.maxY <= outer.maxY
}

/** Quét AutoCAD: trái→phải chỉ lấy hình nằm trọn, phải→trái lấy hình khung chạm. */
export function pickObjectsInMarquee(
  objects: WhiteboardObject[],
  a: WhiteboardPoint,
  b: WhiteboardPoint,
  crossing: boolean,
): string[] {
  const fence: WorldBox = {
    minX: Math.min(a.x, b.x),
    minY: Math.min(a.y, b.y),
    maxX: Math.max(a.x, b.x),
    maxY: Math.max(a.y, b.y),
  }
  if (fence.maxX - fence.minX < 1 && fence.maxY - fence.minY < 1) return []
  const ids: string[] = []
  for (const obj of objects) {
    const box = objectWorldBounds(obj)
    if (!box) continue
    if (crossing ? boxesOverlap(box, fence) : boxInside(box, fence)) ids.push(obj.id)
  }
  return ids
}

export function objectCenter(obj: WhiteboardObject): WhiteboardPoint {
  if (obj.kind === 'graph') return obj.origin
  if (obj.kind === 'shape' && (obj.shape === 'circle' || obj.shape === 'ellipse') && obj.cx != null && obj.cy != null) {
    return { x: obj.cx, y: obj.cy }
  }
  const pts = objectPoints(obj)
  if (pts.length === 0) return { x: 0, y: 0 }
  let x = 0
  let y = 0
  for (const p of pts) {
    x += p.x
    y += p.y
  }
  return { x: x / pts.length, y: y / pts.length }
}

export function translateObject(obj: WhiteboardObject, dx: number, dy: number): WhiteboardObject {
  if (obj.kind === 'stroke') return { ...obj, points: obj.points.map((p) => translatePoint(p, dx, dy)) }
  if (obj.kind === 'graph') return { ...obj, origin: translatePoint(obj.origin, dx, dy) }
  return {
    ...obj,
    points: obj.points.map((p) => translatePoint(p, dx, dy)),
    cx: obj.cx != null ? obj.cx + dx : obj.cx,
    cy: obj.cy != null ? obj.cy + dy : obj.cy,
  }
}

export function scaleObject(obj: WhiteboardObject, origin: WhiteboardPoint, factor: number): WhiteboardObject {
  const s = Math.max(0.15, Math.min(8, factor))
  if (obj.kind === 'stroke') return { ...obj, points: obj.points.map((p) => scaleAround(p, origin, s, s)) }
  if (obj.kind === 'graph') return { ...obj, origin: scaleAround(obj.origin, origin, s, s), unit: Math.max(8, obj.unit * s) }
  return {
    ...obj,
    points: obj.points.map((p) => scaleAround(p, origin, s, s)),
    cx: obj.cx != null ? origin.x + (obj.cx - origin.x) * s : obj.cx,
    cy: obj.cy != null ? origin.y + (obj.cy - origin.y) * s : obj.cy,
    r: obj.r != null ? obj.r * s : obj.r,
    rx: obj.rx != null ? obj.rx * s : obj.rx,
    ry: obj.ry != null ? obj.ry * s : obj.ry,
  }
}

export function rotateObject(obj: WhiteboardObject, origin: WhiteboardPoint, rad: number): WhiteboardObject {
  if (obj.kind === 'graph') return obj
  if (obj.kind === 'stroke') return { ...obj, points: obj.points.map((p) => rotateAround(p, origin, rad)) }
  return {
    ...obj,
    points: obj.points.map((p) => rotateAround(p, origin, rad)),
    cx: obj.cx != null ? rotateAround({ x: obj.cx, y: obj.cy ?? 0 }, origin, rad).x : obj.cx,
    cy: obj.cy != null ? rotateAround({ x: obj.cx ?? 0, y: obj.cy }, origin, rad).y : obj.cy,
    rotation: (obj.rotation ?? 0) + rad,
  }
}

function hitStroke(obj: WhiteboardStroke, p: WhiteboardPoint, thresh: number): boolean {
  for (let i = 1; i < obj.points.length; i += 1) {
    if (pointToSegment(p, obj.points[i - 1], obj.points[i]) <= thresh) return true
  }
  return obj.points.some((pt) => dist(pt, p) <= thresh)
}

function hitShape(obj: WhiteboardShape, p: WhiteboardPoint, thresh: number): boolean {
  if (obj.shape === 'circle' && obj.cx != null && obj.cy != null && obj.r != null) {
    return Math.abs(Math.hypot(p.x - obj.cx, p.y - obj.cy) - obj.r) <= thresh
  }
  if (obj.shape === 'ellipse' && obj.cx != null && obj.cy != null && obj.rx != null && obj.ry != null) {
    const rot = -(obj.rotation ?? 0)
    const c = Math.cos(rot)
    const s = Math.sin(rot)
    const dx = p.x - obj.cx
    const dy = p.y - obj.cy
    const lx = (dx * c - dy * s) / obj.rx
    const ly = (dx * s + dy * c) / obj.ry
    return Math.abs(Math.hypot(lx, ly) - 1) <= thresh / Math.max(obj.rx, obj.ry)
  }
  if (obj.shape === 'rect' && obj.points.length >= 2) {
    const a = obj.points[0]
    const b = obj.points[1]
    const minX = Math.min(a.x, b.x)
    const maxX = Math.max(a.x, b.x)
    const minY = Math.min(a.y, b.y)
    const maxY = Math.max(a.y, b.y)
    const inside = p.x >= minX - thresh && p.x <= maxX + thresh && p.y >= minY - thresh && p.y <= maxY + thresh
    const onEdge =
      Math.abs(p.x - minX) <= thresh ||
      Math.abs(p.x - maxX) <= thresh ||
      Math.abs(p.y - minY) <= thresh ||
      Math.abs(p.y - maxY) <= thresh
    return inside && onEdge
  }
  const pts = obj.points
  for (let i = 1; i < pts.length; i += 1) {
    if (pointToSegment(p, pts[i - 1], pts[i]) <= thresh) return true
  }
  if ((obj.shape === 'polygon' || obj.shape === 'triangle') && pts.length >= 3) {
    if (pointToSegment(p, pts[pts.length - 1], pts[0]) <= thresh) return true
  }
  return false
}

function hitGraph(obj: WhiteboardGraph, p: WhiteboardPoint, thresh: number): boolean {
  const axisThresh = Math.max(thresh, 8)
  if (Math.abs(p.y - obj.origin.y) <= axisThresh && Math.abs(p.x - obj.origin.x) < obj.unit * 8) return true
  if (Math.abs(p.x - obj.origin.x) <= axisThresh && Math.abs(p.y - obj.origin.y) < obj.unit * 8) return true
  return dist(p, obj.origin) <= thresh + 10
}

export function hitTestObject(obj: WhiteboardObject, p: WhiteboardPoint, thresh: number): boolean {
  if (obj.kind === 'stroke') return hitStroke(obj, p, thresh)
  if (obj.kind === 'graph') return hitGraph(obj, p, thresh)
  return hitShape(obj, p, thresh)
}

export function hitTestTop(objects: WhiteboardObject[], p: WhiteboardPoint, thresh: number): WhiteboardObject | null {
  for (let i = objects.length - 1; i >= 0; i -= 1) {
    if (hitTestObject(objects[i], p, thresh)) return objects[i]
  }
  return null
}

export function snapPointsOf(objects: WhiteboardObject[]): WhiteboardPoint[] {
  const out: WhiteboardPoint[] = []
  for (const obj of objects) {
    if (obj.kind === 'graph') {
      out.push(obj.origin)
      continue
    }
    if (obj.kind === 'shape' && obj.shape === 'circle' && obj.cx != null && obj.cy != null && obj.r != null) {
      out.push({ x: obj.cx, y: obj.cy })
      out.push({ x: obj.cx + obj.r, y: obj.cy })
      out.push({ x: obj.cx - obj.r, y: obj.cy })
      out.push({ x: obj.cx, y: obj.cy + obj.r })
      out.push({ x: obj.cx, y: obj.cy - obj.r })
      continue
    }
    out.push(...objectPoints(obj))
  }
  return out
}

export function snapToObjects(p: WhiteboardPoint, objects: WhiteboardObject[], radius: number): WhiteboardPoint {
  let best = p
  let bestD = radius
  for (const q of snapPointsOf(objects)) {
    const d = dist(p, q)
    if (d < bestD) {
      bestD = d
      best = q
    }
  }
  return best
}

export function applyWhiteboardMessage(state: WhiteboardState, msg: WhiteboardWireMessage | Record<string, unknown>): WhiteboardState {
  const type = typeof msg.type === 'string' ? msg.type : ''
  if (type === 'whiteboard-sync') {
    return {
      ...state,
      objects: sanitizeWhiteboardObjects((msg as { objects?: unknown }).objects),
      camera: sanitizeWhiteboardCamera((msg as { camera?: unknown }).camera),
      draft: null,
      grid: typeof (msg as { grid?: unknown }).grid === 'boolean' ? Boolean((msg as { grid?: unknown }).grid) : state.grid,
    }
  }
  if (type === 'whiteboard-upsert') {
    const object = sanitizeWhiteboardObject((msg as { object?: unknown }).object)
    if (!object) return state
    return { ...state, objects: upsertWhiteboardObject(state.objects, object), draft: null }
  }
  if (type === 'whiteboard-remove') {
    const ids = Array.isArray((msg as { ids?: unknown }).ids)
      ? ((msg as { ids: unknown[] }).ids.filter((id) => typeof id === 'string') as string[])
      : []
    if (ids.length === 0) return state
    const drop = new Set(ids)
    return { ...state, objects: state.objects.filter((obj) => !drop.has(obj.id)) }
  }
  if (type === 'whiteboard-clear') return { ...state, objects: [], draft: null }
  if (type === 'whiteboard-camera') {
    return { ...state, camera: sanitizeWhiteboardCamera((msg as { camera?: unknown }).camera) }
  }
  if (type === 'whiteboard-draft') {
    const draft = sanitizeWhiteboardDraft((msg as { draft?: unknown }).draft)
    if (draft && state.objects.some((obj) => obj.id === draft.id)) return { ...state, draft: null }
    return { ...state, draft }
  }
  if (type === 'whiteboard-grid' && typeof (msg as { grid?: unknown }).grid === 'boolean') {
    return { ...state, grid: Boolean((msg as { grid?: unknown }).grid) }
  }
  return state
}

export function isWhiteboardWireType(type: string): boolean {
  return (
    type === 'whiteboard-sync' ||
    type === 'whiteboard-upsert' ||
    type === 'whiteboard-remove' ||
    type === 'whiteboard-clear' ||
    type === 'whiteboard-camera' ||
    type === 'whiteboard-draft' ||
    type === 'whiteboard-grid'
  )
}
