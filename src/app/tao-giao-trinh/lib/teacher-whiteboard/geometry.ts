import type { WhiteboardPoint } from './types'

export function dist(a: WhiteboardPoint, b: WhiteboardPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function lerpPoint(a: WhiteboardPoint, b: WhiteboardPoint, t: number): WhiteboardPoint {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

/** Thêm điểm vẽ tay: nội suy khi nhảy xa, không ghim lưới. */
export function appendInkPoint(points: WhiteboardPoint[], p: WhiteboardPoint): void {
  const last = points[points.length - 1]
  if (!last) {
    points.push(p)
    return
  }
  const gap = dist(last, p)
  if (gap < 0.7) return
  if (gap > 8) {
    const steps = Math.min(16, Math.floor(gap / 4))
    for (let i = 1; i <= steps; i += 1) {
      points.push(lerpPoint(last, p, i / (steps + 1)))
    }
  }
  points.push(p)
}

export function pathLength(points: WhiteboardPoint[]): number {
  let n = 0
  for (let i = 1; i < points.length; i += 1) n += dist(points[i - 1], points[i])
  return n
}

export function centroid(points: WhiteboardPoint[]): WhiteboardPoint {
  if (points.length === 0) return { x: 0, y: 0 }
  let x = 0
  let y = 0
  for (const p of points) {
    x += p.x
    y += p.y
  }
  return { x: x / points.length, y: y / points.length }
}

export function boundsOf(points: WhiteboardPoint[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  return { minX, minY, maxX, maxY }
}

export function pointToSegment(p: WhiteboardPoint, a: WhiteboardPoint, b: WhiteboardPoint): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  if (len2 < 1e-8) return dist(p, a)
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t))
}

export function simplifyRdp(points: WhiteboardPoint[], epsilon: number): WhiteboardPoint[] {
  if (points.length < 3) return points.slice()
  let maxD = 0
  let idx = 0
  const first = points[0]
  const last = points[points.length - 1]
  for (let i = 1; i < points.length - 1; i += 1) {
    const d = pointToSegment(points[i], first, last)
    if (d > maxD) {
      maxD = d
      idx = i
    }
  }
  if (maxD <= epsilon) return [first, last]
  const left = simplifyRdp(points.slice(0, idx + 1), epsilon)
  const right = simplifyRdp(points.slice(idx), epsilon)
  return [...left.slice(0, -1), ...right]
}

export function snapToGrid(p: WhiteboardPoint, grid: number): WhiteboardPoint {
  const g = Math.max(4, grid)
  return { x: Math.round(p.x / g) * g, y: Math.round(p.y / g) * g }
}

export function rotateAround(p: WhiteboardPoint, origin: WhiteboardPoint, rad: number): WhiteboardPoint {
  const c = Math.cos(rad)
  const s = Math.sin(rad)
  const x = p.x - origin.x
  const y = p.y - origin.y
  return { x: origin.x + x * c - y * s, y: origin.y + x * s + y * c }
}

export function translatePoint(p: WhiteboardPoint, dx: number, dy: number): WhiteboardPoint {
  return { x: p.x + dx, y: p.y + dy }
}

export function scaleAround(p: WhiteboardPoint, origin: WhiteboardPoint, sx: number, sy: number): WhiteboardPoint {
  return { x: origin.x + (p.x - origin.x) * sx, y: origin.y + (p.y - origin.y) * sy }
}

export function clampWhiteboardScale(scale: number): number {
  return Math.max(0.5, Math.min(4, scale))
}

/** Nấc nút phóng to / thu nhỏ: đúng bội số 10%. 65 thành 70 hoặc 60. 100 thành 110 hoặc 90. */
export function whiteboardZoomStepPercent(percent: number, direction: 1 | -1): number {
  const pct = Math.round(percent)
  const next = pct % 10 === 0
    ? pct + direction * 10
    : direction > 0
      ? Math.ceil(pct / 10) * 10
      : Math.floor(pct / 10) * 10
  return Math.max(50, Math.min(400, next))
}

/** Cỡ chấm, chữ, mũi tên. Bảng chính giữ pixel thiết kế. Bản đồ nhỏ thu theo tỷ lệ camera. */
export function whiteboardChromeScale(scale: number): number {
  const next = scale || 1
  return next < 1 ? next : 1
}

export function screenToWorld(
  sx: number,
  sy: number,
  cam: { x: number; y: number; scale: number },
  w: number,
  h: number,
): WhiteboardPoint {
  const scale = cam.scale || 1
  return { x: cam.x + (sx - w / 2) / scale, y: cam.y + (sy - h / 2) / scale }
}

/** Zoom giữ một điểm màn hình đứng yên (con trỏ, góc đối diện, tâm hai ngón). */
export function cameraZoomKeepingPoint(
  cam: { x: number; y: number; scale: number },
  screen: WhiteboardPoint,
  nextScale: number,
  w: number,
  h: number,
): { x: number; y: number; scale: number } {
  const world = screenToWorld(screen.x, screen.y, cam, w, h)
  const scale = clampWhiteboardScale(nextScale)
  return {
    x: world.x - (screen.x - w / 2) / scale,
    y: world.y - (screen.y - h / 2) / scale,
    scale,
  }
}

/** Hai ngón: mở ra phóng to, khép lại thu nhỏ; kéo cặp ngón thì pan theo tâm. */
export function cameraForPinchGesture(
  cam: { x: number; y: number; scale: number },
  startScreen: WhiteboardPoint,
  startDist: number,
  nowScreen: WhiteboardPoint,
  nowDist: number,
  w: number,
  h: number,
): { x: number; y: number; scale: number } {
  const scale = clampWhiteboardScale(cam.scale * (nowDist / Math.max(8, startDist)))
  const world = screenToWorld(startScreen.x, startScreen.y, cam, w, h)
  return {
    x: world.x - (nowScreen.x - w / 2) / scale,
    y: world.y - (nowScreen.y - h / 2) / scale,
    scale,
  }
}

/** Giao của hai đoạn. Trùng đầu mút của cả hai đoạn thì bỏ, vì đó là đỉnh đã có dấu. */
export function segmentIntersection(
  a: WhiteboardPoint,
  b: WhiteboardPoint,
  c: WhiteboardPoint,
  d: WhiteboardPoint,
): WhiteboardPoint | null {
  const rx = b.x - a.x
  const ry = b.y - a.y
  const qx = d.x - c.x
  const qy = d.y - c.y
  const den = rx * qy - ry * qx
  if (Math.abs(den) < 1e-8) return null
  const t = ((c.x - a.x) * qy - (c.y - a.y) * qx) / den
  const u = ((c.x - a.x) * ry - (c.y - a.y) * rx) / den
  if (t < -1e-4 || t > 1 + 1e-4 || u < -1e-4 || u > 1 + 1e-4) return null
  const hit = { x: a.x + t * rx, y: a.y + t * ry }
  const endA = Math.min(dist(hit, a), dist(hit, b)) < 1.5
  const endB = Math.min(dist(hit, c), dist(hit, d)) < 1.5
  if (endA && endB) return null
  return hit
}

export function worldToScreen(
  p: WhiteboardPoint,
  cam: { x: number; y: number; scale: number },
  w: number,
  h: number,
): WhiteboardPoint {
  const scale = cam.scale || 1
  return { x: (p.x - cam.x) * scale + w / 2, y: (p.y - cam.y) * scale + h / 2 }
}
