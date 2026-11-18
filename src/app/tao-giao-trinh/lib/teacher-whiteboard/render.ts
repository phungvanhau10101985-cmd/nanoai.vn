import { worldToScreen } from './geometry'
import {
  PLOT_AXIS_SPAN,
  axisTickStep,
  extremaMarkerColor,
  formatAxisNumber,
  mathToWorld,
  parsePlotInput,
  samplePlot,
} from './plot'
import { labelIntersections, labelPlotExtrema, type ExtremumPart } from './extrema-label'
import { resolveTriangleLine, triangleVertexName } from './triangle-line'
import type { TriangleMark } from './types'
import type { WhiteboardCamera, WhiteboardDraft, WhiteboardObject, WhiteboardPoint } from './types'
import { WHITEBOARD_GRID } from './types'

function line(ctx: CanvasRenderingContext2D, a: WhiteboardPoint, b: WhiteboardPoint) {
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.stroke()
}

function poly(ctx: CanvasRenderingContext2D, pts: WhiteboardPoint[], closed: boolean) {
  if (pts.length < 2) return
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y)
  if (closed) ctx.closePath()
  ctx.stroke()
}

function smoothStroke(ctx: CanvasRenderingContext2D, pts: WhiteboardPoint[]) {
  if (pts.length < 3) {
    poly(ctx, pts, false)
    return
  }
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  ctx.lineTo((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2)
  for (let i = 1; i < pts.length - 1; i += 1) {
    const nx = (pts[i].x + pts[i + 1].x) / 2
    const ny = (pts[i].y + pts[i + 1].y) / 2
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, nx, ny)
  }
  const last = pts[pts.length - 1]
  ctx.lineTo(last.x, last.y)
  ctx.stroke()
}

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  cam: WhiteboardCamera,
  w: number,
  h: number,
  grid = WHITEBOARD_GRID,
) {
  const scale = cam.scale || 1
  const step = grid * scale
  if (step < 10) return
  const origin = worldToScreen({ x: 0, y: 0 }, cam, w, h)
  ctx.save()
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.08)'
  ctx.lineWidth = 1
  const startX = ((origin.x % step) + step) % step
  const startY = ((origin.y % step) + step) % step
  ctx.beginPath()
  for (let x = startX; x <= w; x += step) {
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h)
  }
  for (let y = startY; y <= h; y += step) {
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
  }
  ctx.stroke()
  ctx.strokeStyle = 'rgba(37, 99, 235, 0.28)'
  ctx.lineWidth = 1.25
  line(ctx, { x: 0, y: origin.y }, { x: w, y: origin.y })
  line(ctx, { x: origin.x, y: 0 }, { x: origin.x, y: h })
  ctx.restore()
}

function screenPts(points: WhiteboardPoint[], cam: WhiteboardCamera, w: number, h: number): WhiteboardPoint[] {
  return points.map((p) => worldToScreen(p, cam, w, h))
}

function drawArrowhead(ctx: CanvasRenderingContext2D, from: WhiteboardPoint, to: WhiteboardPoint, size: number) {
  const ang = Math.atan2(to.y - from.y, to.x - from.x)
  const len = Math.max(10, size * 4)
  ctx.beginPath()
  ctx.moveTo(to.x, to.y)
  ctx.lineTo(to.x - len * Math.cos(ang - 0.45), to.y - len * Math.sin(ang - 0.45))
  ctx.moveTo(to.x, to.y)
  ctx.lineTo(to.x - len * Math.cos(ang + 0.45), to.y - len * Math.sin(ang + 0.45))
  ctx.stroke()
}

function drawExtremumLabel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  parts: ExtremumPart[],
  color: string,
  fontPx: number,
) {
  ctx.save()
  ctx.fillStyle = color
  ctx.strokeStyle = color
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.font = `bold ${fontPx}px ui-sans-serif, system-ui`
  let cursor = x
  for (const part of parts) {
    if (part.t === 'text') {
      ctx.fillText(part.s, cursor, y)
      cursor += ctx.measureText(part.s).width
      continue
    }
    const small = Math.max(9, fontPx - 1)
    ctx.font = `bold ${small}px ui-sans-serif, system-ui`
    const width = Math.max(ctx.measureText(part.num).width, ctx.measureText(part.den).width) + 6
    ctx.textAlign = 'center'
    ctx.fillText(part.num, cursor + width / 2, y - small * 0.62)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(cursor + 1, y)
    ctx.lineTo(cursor + width - 1, y)
    ctx.stroke()
    ctx.fillText(part.den, cursor + width / 2, y + small * 0.7)
    ctx.textAlign = 'left'
    ctx.font = `bold ${fontPx}px ui-sans-serif, system-ui`
    cursor += width
  }
  ctx.restore()
}

/** Chỗ đặt chữ hàm: trong khung trục, xa nét đồ thị nhất, hơi ưu tiên phía trên. */
export function formulaLabelOrigin(
  textWidth: number,
  textHeight: number,
  curve: WhiteboardPoint[],
  box: { left: number; top: number; right: number; bottom: number },
): { x: number; y: number } {
  const tw = Math.max(8, textWidth)
  const th = Math.max(8, textHeight)
  const left = box.left
  const top = box.top
  const right = Math.max(left, box.right - tw)
  const bottom = Math.max(top, box.bottom - th)
  const cols = 7
  const rows = 5
  let best = { x: left, y: top }
  let bestScore = -Infinity
  const step = Math.max(1, Math.floor(curve.length / 80))
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = cols === 1 ? left : left + ((right - left) * col) / (cols - 1)
      const y = rows === 1 ? top : top + ((bottom - top) * row) / (rows - 1)
      const rect = { x: x - 6, y: y - 4, w: tw + 12, h: th + 8 }
      let clearance = 80
      for (let i = 0; i < curve.length; i += step) {
        const p = curve[i]
        const dx = p.x < rect.x ? rect.x - p.x : p.x > rect.x + rect.w ? p.x - (rect.x + rect.w) : 0
        const dy = p.y < rect.y ? rect.y - p.y : p.y > rect.y + rect.h ? p.y - (rect.y + rect.h) : 0
        const dist = dx === 0 && dy === 0 ? 0 : Math.hypot(dx, dy)
        if (dist < clearance) clearance = dist
        if (clearance === 0) break
      }
      const score = clearance - (y - top) * 0.08
      if (score > bestScore) {
        bestScore = score
        best = { x, y }
      }
    }
  }
  return best
}

function drawGraph(
  ctx: CanvasRenderingContext2D,
  obj: Extract<WhiteboardObject, { kind: 'graph' }>,
  cam: WhiteboardCamera,
  w: number,
  h: number,
  axes = true,
  labelSlot = 0,
) {
  const origin = worldToScreen(obj.origin, cam, w, h)
  const unit = obj.unit * (cam.scale || 1)
  const span = PLOT_AXIS_SPAN
  const xEnd = { x: origin.x + unit * span, y: origin.y }
  const yEnd = { x: origin.x, y: origin.y - unit * span }
  const fontPx = Math.max(10, Math.min(13, unit * 0.32))
  if (axes) {
  ctx.strokeStyle = 'rgba(15,23,42,0.78)'
  ctx.fillStyle = 'rgba(15,23,42,0.86)'
  ctx.lineWidth = 1.35
  line(ctx, { x: origin.x - unit * span, y: origin.y }, xEnd)
  line(ctx, { x: origin.x, y: origin.y + unit * span }, yEnd)
  drawArrowhead(ctx, origin, xEnd, 3)
  drawArrowhead(ctx, origin, yEnd, 3)

  const tick = axisTickStep(unit)
  ctx.font = `${fontPx}px ui-sans-serif, system-ui`
  ctx.fillStyle = 'rgba(15,23,42,0.88)'
  for (let n = -span; n <= span; n += tick) {
    if (n === 0) continue
    const sx = origin.x + n * unit
    const sy = origin.y - n * unit
    ctx.beginPath()
    ctx.moveTo(sx, origin.y - 4)
    ctx.lineTo(sx, origin.y + 4)
    ctx.moveTo(origin.x - 4, sy)
    ctx.lineTo(origin.x + 4, sy)
    ctx.stroke()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(formatAxisNumber(n), sx, origin.y + 6)
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ctx.fillText(formatAxisNumber(n), origin.x - 7, sy)
  }
  ctx.textAlign = 'right'
  ctx.textBaseline = 'top'
  ctx.fillText('0', origin.x - 7, origin.y + 6)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'bottom'
  ctx.fillText('x', xEnd.x + 4, origin.y - 4)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'bottom'
  ctx.fillText('y', origin.x + 6, yEnd.y - 2)
  }

  const parsed = parsePlotInput(obj.axis === 'y' ? `y=${obj.expr}` : `x=${obj.expr}`)
  let curveScreen: WhiteboardPoint[] = []
  if (parsed) {
    const mathPts = samplePlot(parsed, -span, span, 360)
    const world = mathPts.map((p) => mathToWorld(p, obj.origin, obj.unit))
    curveScreen = screenPts(world, cam, w, h)
    ctx.strokeStyle = obj.color
    ctx.lineWidth = Math.max(1.6, 2 * (cam.scale || 1))
    poly(ctx, curveScreen, false)

    const lang = typeof document !== 'undefined' ? document.documentElement.lang || 'vi' : 'vi'
    const extrema = labelPlotExtrema(parsed, -span, span, lang)
    const mark = extremaMarkerColor(obj.color)
    const r = Math.max(3.6, 4.4 * (cam.scale || 1))
    const labelPx = Math.max(11, fontPx)
    for (const ext of extrema) {
      const s = worldToScreen(mathToWorld(ext, obj.origin, obj.unit), cam, w, h)
      ctx.beginPath()
      ctx.fillStyle = '#fff'
      ctx.arc(s.x, s.y, r + 1.4, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.fillStyle = mark
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2)
      ctx.fill()
      drawExtremumLabel(ctx, s.x + r + 6, s.y - labelPx, ext.parts, mark, labelPx)
    }
  }
  const formula = obj.axis === 'y' ? `y=${obj.expr}` : `x=${obj.expr}`
  const formulaPx = Math.max(12, fontPx)
  ctx.font = `bold ${formulaPx}px ui-sans-serif, system-ui`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  const spot = formulaLabelOrigin(
    ctx.measureText(formula).width,
    formulaPx + 2,
    curveScreen,
    {
      left: origin.x + 22,
      top: yEnd.y + 8 + labelSlot * (formulaPx + 8),
      right: Math.min(w - 8, xEnd.x - 4),
      bottom: origin.y - 10,
    },
  )
  ctx.lineWidth = 4
  ctx.strokeStyle = '#f8fafc'
  ctx.strokeText(formula, spot.x, spot.y)
  ctx.fillStyle = obj.color
  ctx.fillText(formula, spot.x, spot.y)
}

export function drawObject(
  ctx: CanvasRenderingContext2D,
  obj: WhiteboardObject,
  cam: WhiteboardCamera,
  w: number,
  h: number,
  selected = false,
  axes = true,
  labelSlot = 0,
) {
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = obj.color
  ctx.fillStyle = obj.color
  const eraser = obj.kind === 'stroke' && obj.tool === 'eraser'
  const lw = Math.max(1.2, (obj.kind === 'graph' ? 2 : eraser ? obj.size * 2.4 : obj.size) * (cam.scale || 1))
  ctx.lineWidth = lw
  if (eraser) ctx.globalCompositeOperation = 'destination-out'
  if (obj.kind === 'stroke') {
    smoothStroke(ctx, screenPts(obj.points, cam, w, h))
  } else if (obj.kind === 'shape') {
    if (obj.shape === 'circle' && obj.cx != null && obj.cy != null && obj.r != null) {
      const c = worldToScreen({ x: obj.cx, y: obj.cy }, cam, w, h)
      ctx.beginPath()
      ctx.arc(c.x, c.y, obj.r * (cam.scale || 1), 0, Math.PI * 2)
      ctx.stroke()
    } else if (obj.shape === 'ellipse' && obj.cx != null && obj.cy != null && obj.rx != null && obj.ry != null) {
      const c = worldToScreen({ x: obj.cx, y: obj.cy }, cam, w, h)
      ctx.beginPath()
      ctx.ellipse(c.x, c.y, obj.rx * (cam.scale || 1), obj.ry * (cam.scale || 1), obj.rotation ?? 0, 0, Math.PI * 2)
      ctx.stroke()
    } else if (obj.shape === 'rect' && obj.points.length >= 2) {
      const a = worldToScreen(obj.points[0], cam, w, h)
      const b = worldToScreen(obj.points[1], cam, w, h)
      ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y))
    } else if (obj.shape === 'arrow' && obj.points.length >= 2) {
      const pts = screenPts(obj.points, cam, w, h)
      poly(ctx, pts, false)
      drawArrowhead(ctx, pts[pts.length - 2], pts[pts.length - 1], lw)
    } else if (obj.shape === 'triangle' && obj.points.length >= 3) {
      poly(ctx, screenPts(obj.points, cam, w, h), true)
      drawTriangleVertices(ctx, obj.points, cam, w, h, obj.color, obj.triangle)
    } else {
      const pts = screenPts(obj.points, cam, w, h)
      poly(ctx, pts, obj.shape === 'polygon')
      if (obj.triangleLine && pts.length >= 2) drawTriangleLineCaption(ctx, pts, obj.triangleLine.role, obj.color)
    }
  } else {
    drawGraph(ctx, obj, cam, w, h, axes, labelSlot)
  }
  if (selected) {
    ctx.setLineDash([5, 4])
    ctx.strokeStyle = '#2563eb'
    ctx.lineWidth = 1
    const box = selectionBox(obj, cam, w, h)
    if (box) ctx.strokeRect(box.x, box.y, box.w, box.h)
  }
  ctx.restore()
}

export function selectionBox(
  obj: WhiteboardObject,
  cam: WhiteboardCamera,
  w: number,
  h: number,
): { x: number; y: number; w: number; h: number } | null {
  const pts: WhiteboardPoint[] = []
  if (obj.kind === 'stroke') pts.push(...screenPts(obj.points, cam, w, h))
  else if (obj.kind === 'graph') {
    const o = worldToScreen(obj.origin, cam, w, h)
    const u = obj.unit * (cam.scale || 1)
    pts.push({ x: o.x - u * 8, y: o.y - u * 8 }, { x: o.x + u * 8, y: o.y + u * 8 })
  } else if (obj.shape === 'circle' && obj.cx != null && obj.cy != null && obj.r != null) {
    const c = worldToScreen({ x: obj.cx, y: obj.cy }, cam, w, h)
    const r = obj.r * (cam.scale || 1)
    pts.push({ x: c.x - r, y: c.y - r }, { x: c.x + r, y: c.y + r })
  } else if (obj.shape === 'ellipse' && obj.cx != null && obj.cy != null && obj.rx != null && obj.ry != null) {
    const c = worldToScreen({ x: obj.cx, y: obj.cy }, cam, w, h)
    const rx = obj.rx * (cam.scale || 1)
    const ry = obj.ry * (cam.scale || 1)
    pts.push({ x: c.x - rx, y: c.y - ry }, { x: c.x + rx, y: c.y + ry })
  } else {
    pts.push(...screenPts(obj.points, cam, w, h))
  }
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
  return { x: minX - 8, y: minY - 8, w: maxX - minX + 16, h: maxY - minY + 16 }
}

export function drawDraft(
  ctx: CanvasRenderingContext2D,
  draft: WhiteboardDraft,
  cam: WhiteboardCamera,
  w: number,
  h: number,
) {
  ctx.save()
  const eraser = draft.tool === 'eraser'
  ctx.strokeStyle = draft.color
  ctx.lineWidth = Math.max(1.2, (eraser ? draft.size * 2.4 : draft.size) * (cam.scale || 1))
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (eraser) ctx.globalCompositeOperation = 'destination-out'
  smoothStroke(ctx, screenPts(draft.points, cam, w, h))
  ctx.restore()
}

let inkLayer: HTMLCanvasElement | null = null

function inkContext(w: number, h: number, dpr: number): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null
  if (!inkLayer) inkLayer = document.createElement('canvas')
  const pxW = Math.max(1, Math.floor(w * dpr))
  const pxH = Math.max(1, Math.floor(h * dpr))
  if (inkLayer.width !== pxW) inkLayer.width = pxW
  if (inkLayer.height !== pxH) inkLayer.height = pxH
  const ictx = inkLayer.getContext('2d')
  if (!ictx) return null
  ictx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ictx.clearRect(0, 0, w, h)
  return ictx
}

const TRIANGLE_LINE_CAPTION: Record<string, string> = {
  altitude: 'cao',
  bisector: 'phân giác',
  median: 'trung tuyến',
  'perp-bisector': 'trung trực',
  midsegment: 'trung bình',
}

function drawHaloText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string) {
  ctx.save()
  ctx.lineWidth = 3
  ctx.strokeStyle = '#f8fafc'
  ctx.fillStyle = color
  ctx.strokeText(text, x, y)
  ctx.fillText(text, x, y)
  ctx.restore()
}

function drawTriangleVertices(
  ctx: CanvasRenderingContext2D,
  world: WhiteboardPoint[],
  cam: WhiteboardCamera,
  w: number,
  h: number,
  color: string,
  mark?: TriangleMark,
) {
  const scr = screenPts(world.slice(0, 3), cam, w, h)
  const cx = (scr[0].x + scr[1].x + scr[2].x) / 3
  const cy = (scr[0].y + scr[1].y + scr[2].y) / 3
  const sideText = mark ? [mark.ab, mark.bc, mark.ca] : ['', '', '']
  ctx.save()
  ctx.font = 'bold 14px ui-sans-serif, system-ui'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (let i = 0; i < 3; i += 1) {
    const p = scr[i]
    ctx.beginPath()
    ctx.fillStyle = '#fff'
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.arc(p.x, p.y, 6, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    const vx = p.x - cx
    const vy = p.y - cy
    const len = Math.hypot(vx, vy) || 1
    drawHaloText(ctx, triangleVertexName(i as 0 | 1 | 2), p.x + (vx / len) * 16, p.y + (vy / len) * 16, color)
    const label = sideText[i]
    if (!label) continue
    const q = scr[(i + 1) % 3]
    const mx = (p.x + q.x) / 2
    const my = (p.y + q.y) / 2
    const ox = mx - cx
    const oy = my - cy
    const olen = Math.hypot(ox, oy) || 1
    ctx.font = 'bold 12px ui-sans-serif, system-ui'
    drawHaloText(ctx, label, mx + (ox / olen) * 14, my + (oy / olen) * 14, color)
    ctx.font = 'bold 14px ui-sans-serif, system-ui'
  }
  ctx.restore()
}

function drawTriangleLineCaption(
  ctx: CanvasRenderingContext2D,
  pts: WhiteboardPoint[],
  role: string,
  color: string,
) {
  const a = pts[0]
  const b = pts[pts.length - 1]
  const mx = (a.x + b.x) / 2
  const my = (a.y + b.y) / 2
  ctx.save()
  ctx.font = 'bold 12px ui-sans-serif, system-ui'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  drawHaloText(ctx, TRIANGLE_LINE_CAPTION[role] || role, mx, my - 6, color)
  ctx.restore()
}

function drawSharedIntersections(
  ctx: CanvasRenderingContext2D,
  objects: WhiteboardObject[],
  cam: WhiteboardCamera,
  w: number,
  h: number,
) {
  const groups = new Map<string, Extract<WhiteboardObject, { kind: 'graph' }>[]>()
  for (const obj of objects) {
    if (obj.kind !== 'graph' || !obj.frameId) continue
    const list = groups.get(obj.frameId) ?? []
    list.push(obj)
    groups.set(obj.frameId, list)
  }
  const color = '#6d28d9'
  for (const list of groups.values()) {
    if (list.length < 2) continue
    const seen: { x: number; y: number }[] = []
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        if (list[i].axis !== list[j].axis) continue
        const left = parsePlotInput(list[i].axis === 'y' ? `y=${list[i].expr}` : `x=${list[i].expr}`)
        const right = parsePlotInput(list[j].axis === 'y' ? `y=${list[j].expr}` : `x=${list[j].expr}`)
        if (!left || !right) continue
        const lang = typeof document !== 'undefined' ? document.documentElement.lang || 'vi' : 'vi'
        const hits = labelIntersections(left, right, -PLOT_AXIS_SPAN, PLOT_AXIS_SPAN, lang)
        hits.forEach((hit, index) => {
          if (seen.some((p) => Math.hypot(p.x - hit.x, p.y - hit.y) < 0.05)) return
          seen.push(hit)
          const s = worldToScreen(mathToWorld(hit, list[i].origin, list[i].unit), cam, w, h)
          ctx.save()
          ctx.fillStyle = '#fff'
          ctx.strokeStyle = color
          ctx.lineWidth = 1.6
          ctx.beginPath()
          ctx.moveTo(s.x, s.y - 5)
          ctx.lineTo(s.x + 5, s.y)
          ctx.lineTo(s.x, s.y + 5)
          ctx.lineTo(s.x - 5, s.y)
          ctx.closePath()
          ctx.fill()
          ctx.stroke()
          drawExtremumLabel(ctx, s.x + 8, s.y - 14 - index * 4, hit.parts, color, 12)
          ctx.restore()
        })
      }
    }
  }
}

export function paintWhiteboard(
  ctx: CanvasRenderingContext2D,
  opts: {
    objects: WhiteboardObject[]
    camera: WhiteboardCamera
    draft?: WhiteboardDraft | null
    grid: boolean
    selectedId?: string | null
    selectedIds?: string[]
    width: number
    height: number
    dpr: number
  },
) {
  const { width: w, height: h, dpr } = opts
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = '#f8fafc'
  ctx.fillRect(0, 0, w, h)
  if (opts.grid) drawGrid(ctx, opts.camera, w, h)
  const ink = inkContext(w, h, dpr)
  const target = ink ?? ctx
  const frameSeen = new Map<string, number>()
  const live = opts.objects.map((obj) => resolveTriangleLine(obj, opts.objects))
  for (const obj of live) {
    let axes = true
    let slot = 0
    if (obj.kind === 'graph') {
      const key = obj.frameId || obj.id
      slot = frameSeen.get(key) ?? 0
      axes = slot === 0
      frameSeen.set(key, slot + 1)
    }
    drawObject(target, obj, opts.camera, w, h, false, axes, slot)
  }
  const draftCoversObject = opts.draft != null && opts.objects.some((obj) => obj.id === opts.draft?.id)
  if (opts.draft && !draftCoversObject) drawDraft(target, opts.draft, opts.camera, w, h)
  if (ink && inkLayer) {
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.drawImage(inkLayer, 0, 0)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  drawSharedIntersections(ctx, opts.objects, opts.camera, w, h)
  const picked = opts.selectedIds && opts.selectedIds.length > 0
    ? opts.selectedIds
    : opts.selectedId
      ? [opts.selectedId]
      : []
  if (picked.length > 0) {
    ctx.save()
    ctx.setLineDash([5, 4])
    ctx.strokeStyle = '#2563eb'
    ctx.lineWidth = 1
    for (const id of picked) {
      const selected = opts.objects.find((obj) => obj.id === id)
      const box = selected ? selectionBox(selected, opts.camera, w, h) : null
      if (box) ctx.strokeRect(box.x, box.y, box.w, box.h)
    }
    ctx.restore()
  }
}
