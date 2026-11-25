import { clampWhiteboardScale, dist, pointToSegment, rotateAround, scaleAround, translatePoint } from './geometry'
import { parseWhiteboardLineType } from './line-type'
import { solidCornerIndices } from './solid'
import { figureClock, figureHandleAt, figureItem } from './figures'
import { isWhiteboardImageSrc } from './image'
import type {
  WhiteboardCamera,
  WhiteboardDim,
  WhiteboardDimKind,
  WhiteboardDraft,
  WhiteboardFigure,
  WhiteboardGraph,
  WhiteboardObject,
  WhiteboardPoint,
  WhiteboardShape,
  WhiteboardState,
  WhiteboardStroke,
  WhiteboardWireMessage,
} from './types'
import { DEFAULT_WHITEBOARD_CAMERA, SOLID_KINDS, WHITEBOARD_DIM_KINDS, WHITEBOARD_MAX_OBJECTS, WHITEBOARD_MAX_POINTS } from './types'

function num(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function sanitizeTune(raw: unknown): number[] {
  if (!Array.isArray(raw)) return []
  const out: number[] = []
  for (const item of raw) {
    const n = Number(item)
    if (!Number.isFinite(n)) continue
    out.push(Math.max(-100000, Math.min(100000, n)))
    if (out.length >= 6) break
  }
  return out
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

function fillOf(raw: unknown): string | undefined {
  const s = typeof raw === 'string' ? raw.trim() : ''
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s : undefined
}

export function sanitizeWhiteboardObject(raw: unknown): WhiteboardObject | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const id = typeof o.id === 'string' && o.id.trim() ? o.id.trim().slice(0, 80) : null
  if (!id) return null
  const color = colorOf(o.color)
  const size = Math.max(1, Math.min(16, num(o.size, 3)))
  const lineType = parseWhiteboardLineType(o.lineType)
  const patterned = lineType && lineType !== 'continuous' ? lineType : undefined
  if (o.kind === 'stroke') {
    const pts = points(o.points)
    if (pts.length < 1) return null
    const fill = o.tool === 'eraser' ? undefined : fillOf(o.fill)
    return {
      kind: 'stroke',
      id,
      tool: o.tool === 'eraser' ? 'eraser' : 'pen',
      color,
      size,
      ...(o.tool === 'eraser' || !patterned ? {} : { lineType: patterned }),
      ...(fill ? { fill } : {}),
      points: pts,
    }
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
      shape !== 'polygon' &&
      shape !== 'solid'
    ) return null
    const fillable = shape === 'circle' || shape === 'ellipse' || shape === 'rect' || shape === 'triangle' || shape === 'polygon'
    const fill = fillable ? fillOf(o.fill) : undefined
    const next: WhiteboardShape = {
      kind: 'shape',
      id,
      shape,
      color,
      size,
      ...(shape === 'solid' || !patterned ? {} : { lineType: patterned }),
      ...(fill ? { fill } : {}),
      points: points(o.points, shape === 'solid' ? 200 : o.fillOnly === true ? 120 : 24),
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
    const quad = o.quad
    if ((shape === 'polygon' || shape === 'rect') && quad && typeof quad === 'object') {
      const mark = quad as Record<string, unknown>
      const kind = mark.kind
      const clip = (value: unknown) => typeof value === 'string' ? value.trim().slice(0, 24) : ''
      if (kind === 'square' || kind === 'rectangle' || kind === 'parallelogram' || kind === 'rhombus' || kind === 'trapezoid') {
        next.quad = {
          kind,
          ab: clip(mark.ab),
          bc: clip(mark.bc),
          cd: clip(mark.cd),
          da: clip(mark.da),
          angle: clip(mark.angle) || '90',
        }
      }
    }
    if (Array.isArray(o.quadNames) && o.quadNames.length >= 4) {
      const names = o.quadNames.slice(0, 4).map((item) => typeof item === 'string' ? item.trim().slice(0, 4) : '')
      if (names.every((item) => item)) next.quadNames = names as [string, string, string, string]
    }
    if (Array.isArray(o.vertexNames) && o.vertexNames.length >= 3) {
      const names = o.vertexNames.slice(0, 3).map((item) => typeof item === 'string' ? item.trim().slice(0, 4) : '')
      if (names.every((item) => item)) next.vertexNames = names as [string, string, string]
    }
    if (o.regionOnly === true && shape === 'triangle') next.regionOnly = true
    if (o.fillOnly === true && shape === 'polygon' && fill && next.points.length >= 3) next.fillOnly = true
    if (shape === 'solid') {
      const kind = o.solid
      if (typeof kind !== 'string' || !(SOLID_KINDS as readonly string[]).includes(kind)) return null
      const raw = Array.isArray(o.solidEdges) ? o.solidEdges : []
      const edges: number[] = []
      for (let i = 0; i + 1 < raw.length && edges.length < 400; i += 2) {
        const a = raw[i]
        const b = raw[i + 1]
        if (typeof a !== 'number' || typeof b !== 'number') continue
        const ia = Math.floor(a)
        const ib = Math.floor(b)
        if (ia < 0 || ib < 0 || ia >= next.points.length || ib >= next.points.length) continue
        edges.push(ia, ib)
      }
      if (edges.length < 2) return null
      const pairs = edges.length / 2
      const hidden = typeof o.solidHidden === 'number' ? Math.max(0, Math.min(pairs, Math.floor(o.solidHidden))) : 0
      next.solid = kind as WhiteboardShape['solid']
      next.solidEdges = edges
      next.solidHidden = hidden
      if (Array.isArray(o.solidCorners)) {
        const corners: number[] = []
        for (const item of o.solidCorners) {
          if (typeof item !== 'number') continue
          const index = Math.floor(item)
          if (index < 0 || index >= next.points.length || corners.includes(index)) continue
          corners.push(index)
          if (corners.length >= 32) break
        }
        if (corners.length > 0) next.solidCorners = corners
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
        const footName = typeof mark.footName === 'string' ? mark.footName.trim().slice(0, 4) : ''
        next.triangleLine = { role, vertex, triangleId, ...(footName ? { footName } : {}) }
      }
    }
    return next
  }
  if (o.kind === 'dim') {
    const dim = WHITEBOARD_DIM_KINDS.includes(o.dim as WhiteboardDimKind) ? o.dim as WhiteboardDimKind : null
    const pts = points(o.points, 4)
    if (!dim || pts.length < 2) return null
    return { kind: 'dim', id, color, size, dim, points: pts }
  }
  if (o.kind === 'text') {
    const text = typeof o.text === 'string' ? o.text.replace(/\r\n/g, '\n').slice(0, 2000) : ''
    if (!text.trim()) return null
    return {
      kind: 'text',
      id,
      color,
      size: Math.max(12, Math.min(96, num(o.size, 28))),
      text,
      x: num(o.x),
      y: num(o.y),
      width: Math.max(48, Math.min(1600, num(o.width, 320))),
    }
  }
  if (o.kind === 'figure') {
    const figure = typeof o.figure === 'string' ? o.figure : ''
    const item = figureItem(figure)
    if (!item) return null
    const raw = o.params && typeof o.params === 'object' ? o.params as Record<string, unknown> : {}
    const asked = typeof raw.variant === 'string' ? raw.variant.slice(0, 40) : ''
    const variant = item.variants?.some((entry) => entry.id === asked) ? asked : (item.variants?.[0]?.id ?? '')
    const liquid = typeof raw.liquid === 'string' && /^#[0-9a-fA-F]{6}$/.test(raw.liquid) ? raw.liquid : '#7dd3fc'
    return {
      kind: 'figure',
      id,
      color,
      figure,
      x: num(o.x),
      y: num(o.y),
      w: Math.max(80, Math.min(900, num(o.w, item.w))),
      h: Math.max(60, Math.min(700, num(o.h, item.h))),
      params: {
        variant,
        liquid,
        level: Math.max(0, Math.min(100, num(raw.level, 62))),
        label: typeof raw.label === 'string' ? raw.label.slice(0, 24) : '',
        equation: typeof raw.equation === 'string' ? raw.equation.slice(0, 120) : '',
        tune: sanitizeTune(raw.tune),
        run: raw.run === true,
        clock: num(raw.clock, 0),
        shift: num(raw.shift, 0),
      },
    }
  }
  if (o.kind === 'image') {
    if (!isWhiteboardImageSrc(o.src)) return null
    return {
      kind: 'image',
      id,
      src: o.src,
      x: num(o.x),
      y: num(o.y),
      w: Math.max(48, Math.min(1200, num(o.w, 280))),
      h: Math.max(36, Math.min(900, num(o.h, 200))),
    }
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
  const scale = clampWhiteboardScale(num(c.scale, 1))
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
    ...(o.tool === 'eraser' ? {} : (() => {
      const lineType = parseWhiteboardLineType(o.lineType)
      return lineType && lineType !== 'continuous' ? { lineType } : {}
    })()),
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
  if (obj.kind === 'stroke' || obj.kind === 'dim') return obj.points
  if (obj.kind === 'text') {
    const box = textWorldBox(obj)
    return [
      { x: box.minX, y: box.minY },
      { x: box.maxX, y: box.minY },
      { x: box.maxX, y: box.maxY },
      { x: box.minX, y: box.maxY },
    ]
  }
  if (obj.kind === 'figure' || obj.kind === 'image') {
    return [
      { x: obj.x, y: obj.y },
      { x: obj.x + obj.w, y: obj.y },
      { x: obj.x + obj.w, y: obj.y + obj.h },
      { x: obj.x, y: obj.y + obj.h },
    ]
  }
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

/** Vùng bản đồ con: gộp khung đang xem và mọi nét, có lề. */
export function whiteboardOverviewBounds(
  objects: WhiteboardObject[],
  cam: WhiteboardCamera,
  viewW: number,
  viewH: number,
): WorldBox {
  const scale = cam.scale || 1
  const halfW = Math.max(1, viewW) / (2 * scale)
  const halfH = Math.max(1, viewH) / (2 * scale)
  let minX = cam.x - halfW
  let maxX = cam.x + halfW
  let minY = cam.y - halfH
  let maxY = cam.y + halfH
  for (const obj of objects) {
    const box = objectWorldBounds(obj)
    if (!box) continue
    minX = Math.min(minX, box.minX)
    minY = Math.min(minY, box.minY)
    maxX = Math.max(maxX, box.maxX)
    maxY = Math.max(maxY, box.maxY)
  }
  const padX = Math.max(48, (maxX - minX) * 0.06)
  const padY = Math.max(48, (maxY - minY) * 0.06)
  return { minX: minX - padX, minY: minY - padY, maxX: maxX + padX, maxY: maxY + padY }
}

/** Camera của bản đồ con. Tỷ lệ có thể nhỏ hơn 1 để thấy cả bảng. */
export function overviewCamera(bounds: WorldBox, mapW: number, mapH: number): WhiteboardCamera {
  const worldW = Math.max(1, bounds.maxX - bounds.minX)
  const worldH = Math.max(1, bounds.maxY - bounds.minY)
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
    scale: Math.min(mapW / worldW, mapH / worldH),
  }
}

export function objectWorldBounds(obj: WhiteboardObject): WorldBox | null {
  if (obj.kind === 'graph') {
    const u = obj.unit * 8
    return { minX: obj.origin.x - u, minY: obj.origin.y - u, maxX: obj.origin.x + u, maxY: obj.origin.y + u }
  }
  if (obj.kind === 'text') return textWorldBox(obj)
  if (obj.kind === 'figure' || obj.kind === 'image') return { minX: obj.x, minY: obj.y, maxX: obj.x + obj.w, maxY: obj.y + obj.h }
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

const INSERT_GAP = 16

function insertHits(x: number, y: number, w: number, h: number, boxes: WorldBox[]): boolean {
  const mine: WorldBox = { minX: x - INSERT_GAP, minY: y - INSERT_GAP, maxX: x + w + INSERT_GAP, maxY: y + h + INSERT_GAP }
  return boxes.some((other) => boxesOverlap(mine, other))
}

/** Ô trống gần tâm nhìn nhất. Không trả về chỗ đè vật thể. */
function nearestClearSlot(
  boxes: WorldBox[],
  cam: WhiteboardCamera,
  w: number,
  h: number,
  left: number,
  top: number,
  right: number,
  bottom: number,
): { x: number; y: number } | null {
  const maxX = Math.max(left, right - w)
  const maxY = Math.max(top, bottom - h)
  const step = 32
  let best: { x: number; y: number; d: number } | null = null
  const consider = (x: number, y: number) => {
    if (insertHits(x, y, w, h, boxes)) return
    const d = Math.hypot(x + w / 2 - cam.x, y + h / 2 - cam.y)
    if (!best || d < best.d) best = { x, y, d }
  }
  consider(cam.x - w / 2, cam.y - h / 2)
  for (let y = top; y <= maxY + 0.5; y += step) {
    for (let x = left; x <= maxX + 0.5; x += step) consider(x, y)
  }
  consider(maxX, maxY)
  return best
}

/** Chỗ đặt ảnh hoặc sơ đồ: ô trống trong khung nhìn, hết chỗ thì ra ngoài khung. Không đè vật đang có. */
export function placeWhiteboardImage(
  objects: WhiteboardObject[],
  cam: WhiteboardCamera,
  w: number,
  h: number,
  viewW = 800,
  viewH = 600,
): { x: number; y: number } {
  const scale = cam.scale || 1
  const left = cam.x - viewW / (2 * scale)
  const top = cam.y - viewH / (2 * scale)
  const right = cam.x + viewW / (2 * scale)
  const bottom = cam.y + viewH / (2 * scale)
  const boxes: WorldBox[] = []
  for (const obj of objects) {
    const box = objectWorldBounds(obj)
    if (box) boxes.push(box)
  }
  const inView = nearestClearSlot(boxes, cam, w, h, left, top, right, bottom)
  if (inView && inView.x >= left - 1 && inView.x + w <= right + 1 && inView.y >= top - 1 && inView.y + h <= bottom + 1) return inView
  const span = Math.max(w, h) + INSERT_GAP
  for (let pad = 1; pad <= 6; pad += 1) {
    const grow = pad * span
    const found = nearestClearSlot(boxes, cam, w, h, left - grow, top - grow, right + grow, bottom + grow)
    if (found) return found
  }
  let edge = right
  for (const box of boxes) edge = Math.max(edge, box.maxX)
  let x = edge + INSERT_GAP
  let y = cam.y - h / 2
  for (let i = 0; i < 48 && insertHits(x, y, w, h, boxes); i += 1) y += h + INSERT_GAP
  return { x, y }
}

function boxInside(inner: WorldBox, outer: WorldBox): boolean {
  return inner.minX >= outer.minX && inner.maxX <= outer.maxX && inner.minY >= outer.minY && inner.maxY <= outer.maxY
}

/** Kéo chuột ngắn hơn mức này là một cú chọn, không phải khung chọn nhiều phần tử. Ngón tay không dùng khung chọn. */
export const WHITEBOARD_MARQUEE_MIN_PX = 28

export function whiteboardMarqueeIsSelection(pointer: string, distance: number): boolean {
  if (pointer === 'touch') return false
  return distance >= WHITEBOARD_MARQUEE_MIN_PX
}

/**
 * Chỉ bỏ những id đang được chọn và đang có trên bảng.
 * Phần tử không nằm trong danh sách chọn giữ nguyên, kể cả hàm cùng hệ trục.
 */
export function deleteWhiteboardSelection(
  objects: WhiteboardObject[],
  selectedIds: readonly string[],
): { objects: WhiteboardObject[]; removedIds: string[] } {
  const live = new Set<string>()
  for (const obj of objects) live.add(obj.id)
  const removedIds: string[] = []
  const seen = new Set<string>()
  for (const id of selectedIds) {
    if (!live.has(id) || seen.has(id)) continue
    seen.add(id)
    removedIds.push(id)
  }
  if (removedIds.length === 0) return { objects, removedIds }
  const drop = new Set(removedIds)
  return { objects: objects.filter((obj) => !drop.has(obj.id)), removedIds }
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
    if (obj.kind === 'shape' && obj.regionOnly) continue
    const box = objectWorldBounds(obj)
    if (!box) continue
    const contained = boxInside(box, fence)
    if (obj.kind === 'figure' || obj.kind === 'image') {
      if (contained) ids.push(obj.id)
      continue
    }
    if (crossing ? boxesOverlap(box, fence) : contained) ids.push(obj.id)
  }
  return ids
}

export function objectCenter(obj: WhiteboardObject): WhiteboardPoint {
  if (obj.kind === 'graph') return obj.origin
  if (obj.kind === 'text') return { x: obj.x + obj.width / 2, y: obj.y }
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
  if (obj.kind === 'text') return { ...obj, x: obj.x + dx, y: obj.y + dy }
  if (obj.kind === 'figure' || obj.kind === 'image') return { ...obj, x: obj.x + dx, y: obj.y + dy }
  if (obj.kind === 'stroke' || obj.kind === 'dim') return { ...obj, points: obj.points.map((p) => translatePoint(p, dx, dy)) }
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
  if (obj.kind === 'text') {
    const p = scaleAround({ x: obj.x, y: obj.y }, origin, s, s)
    return { ...obj, x: p.x, y: p.y, size: Math.max(12, Math.min(96, obj.size * s)), width: Math.max(48, obj.width * s) }
  }
  if (obj.kind === 'figure') {
    const p = scaleAround({ x: obj.x, y: obj.y }, origin, s, s)
    const far = scaleAround({ x: obj.x + obj.w, y: obj.y + obj.h }, origin, s, s)
    return { ...obj, x: p.x, y: p.y, w: Math.max(80, far.x - p.x), h: Math.max(60, far.y - p.y) }
  }
  if (obj.kind === 'image') {
    const p = scaleAround({ x: obj.x, y: obj.y }, origin, s, s)
    const far = scaleAround({ x: obj.x + obj.w, y: obj.y + obj.h }, origin, s, s)
    return { ...obj, x: p.x, y: p.y, w: Math.max(48, far.x - p.x), h: Math.max(36, far.y - p.y) }
  }
  if (obj.kind === 'stroke' || obj.kind === 'dim') return { ...obj, points: obj.points.map((p) => scaleAround(p, origin, s, s)) }
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
  if (obj.kind === 'text' || obj.kind === 'figure' || obj.kind === 'image') {
    const p = rotateAround({ x: obj.x, y: obj.y }, origin, rad)
    return { ...obj, x: p.x, y: p.y }
  }
  if (obj.kind === 'graph') return obj
  if (obj.kind === 'stroke' || obj.kind === 'dim') return { ...obj, points: obj.points.map((p) => rotateAround(p, origin, rad)) }
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
  if (obj.shape === 'solid' && obj.solidEdges && obj.solidEdges.length >= 2) {
    const edges = obj.solidEdges
    for (let i = 0; i + 1 < edges.length; i += 2) {
      const a = obj.points[edges[i]]
      const b = obj.points[edges[i + 1]]
      if (a && b && pointToSegment(p, a, b) <= thresh) return true
    }
    return false
  }
  const pts = obj.points
  if (obj.shape === 'arrow' && pts.length >= 4) {
    const tip = pts[1]
    return pointToSegment(p, pts[0], tip) <= thresh
      || pointToSegment(p, tip, pts[2]) <= thresh
      || pointToSegment(p, tip, pts[3]) <= thresh
  }
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

function hitDim(obj: WhiteboardDim, p: WhiteboardPoint, thresh: number): boolean {
  const reach = thresh + 10
  for (let i = 1; i < obj.points.length; i += 1) {
    if (pointToSegment(p, obj.points[i - 1], obj.points[i]) <= reach) return true
  }
  return obj.points.some((pt) => dist(pt, p) <= reach)
}

export function hitTestObject(obj: WhiteboardObject, p: WhiteboardPoint, thresh: number): boolean {
  if (obj.kind === 'shape' && (obj.regionOnly || obj.fillOnly)) return false
  if (obj.kind === 'text') {
    const box = textWorldBox(obj)
    return p.x >= box.minX - thresh && p.x <= box.maxX + thresh && p.y >= box.minY - thresh && p.y <= box.maxY + thresh
  }
  if (obj.kind === 'figure' || obj.kind === 'image') {
    return p.x >= obj.x - thresh && p.x <= obj.x + obj.w + thresh && p.y >= obj.y - thresh && p.y <= obj.y + obj.h + thresh
  }
  if (obj.kind === 'stroke') return hitStroke(obj, p, thresh)
  if (obj.kind === 'graph') return hitGraph(obj, p, thresh)
  if (obj.kind === 'dim') return hitDim(obj, p, thresh)
  return hitShape(obj, p, thresh)
}

export function hitTestDraft(draft: { points?: WhiteboardPoint[] } | null, p: WhiteboardPoint, thresh: number): boolean {
  const points = draft?.points
  if (!points || points.length === 0) return false
  for (let i = 1; i < points.length; i += 1) {
    if (pointToSegment(p, points[i - 1], points[i]) <= thresh) return true
  }
  return points.some((pt) => dist(pt, p) <= thresh)
}

export function hitTestTop(objects: WhiteboardObject[], p: WhiteboardPoint, thresh: number): WhiteboardObject | null {
  let image: WhiteboardObject | null = null
  for (let i = objects.length - 1; i >= 0; i -= 1) {
    const obj = objects[i]
    if (obj.kind === 'image') {
      if (!image && hitTestObject(obj, p, thresh)) image = obj
      continue
    }
    if (hitTestObject(obj, p, thresh)) return obj
  }
  return image
}

/** Nút chạy và núm kéo trên sơ đồ, kể cả khi sơ đồ chưa chọn và có nét đè lên. */
export function topFigureHandle(
  objects: WhiteboardObject[],
  p: WhiteboardPoint,
  thresh: number,
  sim: number,
): { object: WhiteboardFigure; handle: string } | null {
  for (let i = objects.length - 1; i >= 0; i -= 1) {
    const obj = objects[i]
    if (obj.kind !== 'figure') continue
    const handle = figureHandleAt(
      obj.figure,
      obj.params,
      obj.w,
      obj.h,
      { x: p.x - obj.x, y: p.y - obj.y },
      thresh,
      figureClock(obj.params, sim),
    )
    if (handle) return { object: obj, handle }
  }
  return null
}

export function snapPointsOf(objects: WhiteboardObject[]): WhiteboardPoint[] {
  const out: WhiteboardPoint[] = []
  for (const obj of objects) {
    if (obj.kind === 'shape' && obj.fillOnly) continue
    if (obj.kind === 'text' || obj.kind === 'figure' || obj.kind === 'image') continue
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
    if (obj.kind === 'shape' && obj.shape === 'solid') {
      const ids = solidCornerIndices(obj.points, obj.solidEdges ?? [], obj.solidCorners)
      for (const index of ids) {
        const point = obj.points[index]
        if (point) out.push(point)
      }
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
