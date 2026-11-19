import { drawWhiteboardDim } from './dim'
import { segmentIntersection, whiteboardChromeScale, worldToScreen } from './geometry'
import {
  axisTickStep,
  extremaMarkerColor,
  formatAxisNumber,
  mathToWorld,
  parsePlotInput,
  infinitySignLabel,
  plotRuns,
  sharedFrameLayout,
  visibleAxisSpan,
} from './plot'
import { labelIntersections, labelPlotExtrema, type ExtremumPart } from './extrema-label'
import { derivedTriangles, resolveTriangleLine, straightSegments, triangleLinePoints, triangleVertexName } from './triangle-line'
import type { QuadMark, TriangleLineMark, TriangleMark } from './types'
import type { WhiteboardCamera, WhiteboardDraft, WhiteboardObject, WhiteboardPoint } from './types'
import { strokeIsClosed } from './fill-region'
import { whiteboardLineDash } from './line-type'
import { solidCornerIndices } from './solid'
import { textLineHeight, textWorldBox, wrapTextLines } from './text'
import { drawMeasureLabels } from './measure-label'
import { drawWhiteboardFigure, figureClock } from './figures'
import { WHITEBOARD_GRID } from './types'

function line(ctx: CanvasRenderingContext2D, a: WhiteboardPoint, b: WhiteboardPoint) {
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.stroke()
}

function drawSolidEdges(
  ctx: CanvasRenderingContext2D,
  obj: Extract<WhiteboardObject, { kind: 'shape' }>,
  cam: WhiteboardCamera,
  w: number,
  h: number,
) {
  const pts = screenPts(obj.points, cam, w, h)
  const edges = obj.solidEdges ?? []
  const hidden = Math.max(0, Math.min(edges.length / 2, obj.solidHidden ?? 0))
  strokeSolidRun(ctx, pts, edges, 0, hidden, true, cam.scale || 1)
  strokeSolidRun(ctx, pts, edges, hidden, edges.length / 2, false, cam.scale || 1)
  ctx.setLineDash([])
  const ui = whiteboardChromeScale(cam.scale || 1)
  for (const index of solidCornerIndices(obj.points, edges, obj.solidCorners)) {
    const p = pts[index]
    if (p) drawVertexDot(ctx, p.x, p.y, obj.color, ui)
  }
}

function hiddenDash(length: number, scale: number): number[] {
  const unit = Math.max(0.35, scale || 1)
  const dash = 8 * unit
  const gap = 4 * unit
  if (length >= dash + gap) return [dash, gap]
  const piece = Math.max(2.5 * unit, length / 3)
  return [piece, Math.max(1.6 * unit, piece * 0.65)]
}

function strokeSolidRun(
  ctx: CanvasRenderingContext2D,
  pts: WhiteboardPoint[],
  edges: number[],
  fromPair: number,
  toPair: number,
  dash: boolean,
  scale: number,
) {
  const adj = new Map<number, number[]>()
  const left = new Set<number>()
  for (let pair = fromPair; pair < toPair; pair += 1) {
    const a = edges[pair * 2]
    const b = edges[pair * 2 + 1]
    if (!pts[a] || !pts[b]) continue
    left.add(pair)
    const leftList = adj.get(a) ?? []
    leftList.push(pair)
    adj.set(a, leftList)
    const rightList = adj.get(b) ?? []
    rightList.push(pair)
    adj.set(b, rightList)
  }
  const other = (pair: number, at: number) => (edges[pair * 2] === at ? edges[pair * 2 + 1] : edges[pair * 2])
  const openCount = (at: number) => (adj.get(at) ?? []).filter((pair) => left.has(pair)).length
  const take = (at: number) => {
    const list = adj.get(at)
    if (!list) return null
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const pair = list[i]
      if (!left.has(pair)) continue
      left.delete(pair)
      return pair
    }
    return null
  }
  while (left.size > 0) {
    let pair = left.values().next().value as number
    for (const id of left) {
      const a = edges[id * 2]
      const b = edges[id * 2 + 1]
      if (openCount(a) === 1 || openCount(b) === 1) {
        pair = id
        break
      }
    }
    let a = edges[pair * 2]
    let b = edges[pair * 2 + 1]
    if (openCount(a) > openCount(b)) {
      const swap = a
      a = b
      b = swap
    }
    left.delete(pair)
    const chain = [a, b]
    let at = b
    for (;;) {
      const next = take(at)
      if (next == null) break
      at = other(next, at)
      chain.push(at)
      if (at === chain[0]) break
    }
    let length = 0
    for (let i = 1; i < chain.length; i += 1) {
      length += Math.hypot(pts[chain[i]].x - pts[chain[i - 1]].x, pts[chain[i]].y - pts[chain[i - 1]].y)
    }
    ctx.setLineDash(dash ? hiddenDash(length, scale) : [])
    ctx.beginPath()
    ctx.moveTo(pts[chain[0]].x, pts[chain[0]].y)
    for (let i = 1; i < chain.length; i += 1) ctx.lineTo(pts[chain[i]].x, pts[chain[i]].y)
    ctx.stroke()
  }
}

function paintFill(ctx: CanvasRenderingContext2D, fill?: string) {
  if (!fill) return
  ctx.save()
  ctx.fillStyle = fill
  ctx.setLineDash([])
  ctx.fill()
  ctx.restore()
}

function poly(ctx: CanvasRenderingContext2D, pts: WhiteboardPoint[], closed: boolean, fill?: string) {
  if (pts.length < 2) return
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y)
  if (closed) ctx.closePath()
  if (closed) paintFill(ctx, fill)
  ctx.stroke()
}

function smoothStroke(ctx: CanvasRenderingContext2D, pts: WhiteboardPoint[], fill?: string) {
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
  if (fill) ctx.closePath()
  paintFill(ctx, fill)
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
  ctx.strokeStyle = 'rgba(100, 116, 139, 0.55)'
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
  ctx.strokeStyle = 'rgba(37, 99, 235, 0.55)'
  ctx.lineWidth = 1.25
  line(ctx, { x: 0, y: origin.y }, { x: w, y: origin.y })
  line(ctx, { x: origin.x, y: 0 }, { x: origin.x, y: h })
  ctx.restore()
}

function screenPts(points: WhiteboardPoint[], cam: WhiteboardCamera, w: number, h: number): WhiteboardPoint[] {
  return points.map((p) => worldToScreen(p, cam, w, h))
}

function drawInfinityMark(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, label: '+∞' | '−∞', ui = 1) {
  ctx.save()
  ctx.font = `bold ${15 * ui}px ui-sans-serif, system-ui`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 3 * ui
  ctx.strokeStyle = '#f8fafc'
  ctx.strokeText(label, x, y)
  ctx.fillStyle = color
  ctx.fillText(label, x, y)
  ctx.restore()
}

function infinityAnchor(end: WhiteboardPoint, prev: WhiteboardPoint, w: number, h: number, ui = 1): WhiteboardPoint | null {
  if (end.x < -30 * ui || end.y < -30 * ui || end.x > w + 30 * ui || end.y > h + 30 * ui) return null
  const dx = end.x - prev.x
  const dy = end.y - prev.y
  const len = Math.hypot(dx, dy) || 1
  const x = Math.min(w - 18 * ui, Math.max(18 * ui, end.x + (dx / len) * 18 * ui))
  const y = Math.min(h - 14 * ui, Math.max(14 * ui, end.y + (dy / len) * 18 * ui))
  return { x, y }
}

function drawAxisArrow(ctx: CanvasRenderingContext2D, from: WhiteboardPoint, to: WhiteboardPoint, ui: number) {
  const ang = Math.atan2(to.y - from.y, to.x - from.x)
  const len = 11 * ui
  const spread = 0.42
  ctx.beginPath()
  ctx.moveTo(to.x, to.y)
  ctx.lineTo(to.x - len * Math.cos(ang - spread), to.y - len * Math.sin(ang - spread))
  ctx.lineTo(to.x - len * Math.cos(ang + spread), to.y - len * Math.sin(ang + spread))
  ctx.closePath()
  ctx.fill()
}

function drawArrowhead(ctx: CanvasRenderingContext2D, from: WhiteboardPoint, to: WhiteboardPoint, size: number) {
  const ang = Math.atan2(to.y - from.y, to.x - from.x)
  const len = size >= 1.2 ? Math.max(10, size * 4) : Math.max(0.6, size * 4)
  ctx.beginPath()
  ctx.moveTo(to.x, to.y)
  ctx.lineTo(to.x - len * Math.cos(ang - 0.45), to.y - len * Math.sin(ang - 0.45))
  ctx.moveTo(to.x, to.y)
  ctx.lineTo(to.x - len * Math.cos(ang + 0.45), to.y - len * Math.sin(ang + 0.45))
  ctx.stroke()
}

type ScreenRect = { x: number; y: number; w: number; h: number }

function measureExtremumWidth(
  ctx: CanvasRenderingContext2D,
  parts: ExtremumPart[],
  fontPx: number,
): number {
  ctx.save()
  ctx.font = `bold ${fontPx}px ui-sans-serif, system-ui`
  let width = 0
  for (const part of parts) {
    if (part.t === 'text') {
      width += ctx.measureText(part.s).width
      continue
    }
    const small = fontPx >= 10 ? Math.max(9, fontPx - 1) : Math.max(1, fontPx * 0.85)
    ctx.font = `bold ${small}px ui-sans-serif, system-ui`
    width += Math.max(ctx.measureText(part.num).width, ctx.measureText(part.den).width) + 6
    ctx.font = `bold ${fontPx}px ui-sans-serif, system-ui`
  }
  ctx.restore()
  return width
}

function coordinateLabelBox(x: number, y: number, width: number, fontPx: number): ScreenRect {
  const height = fontPx * 2.5
  return { x: x - 6, y: y - height / 2 - 4, w: width + 12, h: height + 8 }
}

function coordinateLabelRects(
  ctx: CanvasRenderingContext2D,
  objects: WhiteboardObject[],
  cam: WhiteboardCamera,
  w: number,
  h: number,
): ScreenRect[] {
  const rects: ScreenRect[] = []
  const lang = typeof document !== 'undefined' ? document.documentElement.lang || 'vi' : 'vi'
  const scale = cam.scale || 1
  const ui = whiteboardChromeScale(scale)
  const graphs = objects.filter((item): item is Extract<WhiteboardObject, { kind: 'graph' }> => item.kind === 'graph')
  for (const obj of graphs) {
    const mates = obj.frameId ? graphs.filter((item) => item.frameId === obj.frameId) : []
    const layout = mates.length >= 2
      ? sharedFrameLayout(mates.map((item) => ({ axis: item.axis, expr: item.expr, unit: item.unit })), scale, w, h)
      : { span: visibleAxisSpan(obj.unit * scale, w, h), unit: obj.unit }
    const parsed = parsePlotInput(obj.axis === 'y' ? `y=${obj.expr}` : `x=${obj.expr}`)
    if (!parsed) continue
    const unit = layout.unit * scale
    const fontPx = Math.max(10 * ui, Math.min(13 * ui, unit * 0.32))
    const labelPx = Math.max(11 * ui, fontPx)
    const radius = Math.max(3.6 * ui, 4.4 * scale)
    for (const ext of labelPlotExtrema(parsed, -layout.span, layout.span, lang)) {
      if (Math.abs(ext.x) > layout.span + 1e-6 || Math.abs(ext.y) > layout.span + 1e-6) continue
      const s = worldToScreen(mathToWorld(ext, obj.origin, layout.unit), cam, w, h)
      rects.push(coordinateLabelBox(s.x + radius + 6 * ui, s.y - labelPx, measureExtremumWidth(ctx, ext.parts, labelPx), labelPx))
    }
  }
  const groups = new Map<string, Extract<WhiteboardObject, { kind: 'graph' }>[]>()
  for (const obj of graphs) {
    if (!obj.frameId) continue
    const list = groups.get(obj.frameId) ?? []
    list.push(obj)
    groups.set(obj.frameId, list)
  }
  for (const list of groups.values()) {
    if (list.length < 2) continue
    const layout = sharedFrameLayout(list.map((item) => ({ axis: item.axis, expr: item.expr, unit: item.unit })), scale, w, h)
    const seen: { x: number; y: number }[] = []
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        if (list[i].axis !== list[j].axis) continue
        const left = parsePlotInput(list[i].axis === 'y' ? `y=${list[i].expr}` : `x=${list[i].expr}`)
        const right = parsePlotInput(list[j].axis === 'y' ? `y=${list[j].expr}` : `x=${list[j].expr}`)
        if (!left || !right) continue
        const hits = labelIntersections(left, right, -layout.span, layout.span, lang)
        hits.forEach((hit, index) => {
          if (Math.abs(hit.x) > layout.span + 1e-6 || Math.abs(hit.y) > layout.span + 1e-6) return
          if (seen.some((p) => Math.hypot(p.x - hit.x, p.y - hit.y) < 0.05)) return
          seen.push(hit)
          const s = worldToScreen(mathToWorld(hit, list[i].origin, layout.unit), cam, w, h)
          const fontPx = 12 * ui
          rects.push(coordinateLabelBox(
            s.x + 8 * ui,
            s.y - (14 + index * 4) * ui,
            measureExtremumWidth(ctx, hit.parts, fontPx),
            fontPx,
          ))
        })
      }
    }
  }
  return rects
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
    const small = fontPx >= 10 ? Math.max(9, fontPx - 1) : Math.max(1, fontPx * 0.85)
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

function rectGap(a: ScreenRect, b: ScreenRect): number {
  const dx = a.x + a.w < b.x ? b.x - (a.x + a.w) : b.x + b.w < a.x ? a.x - (b.x + b.w) : 0
  const dy = a.y + a.h < b.y ? b.y - (a.y + a.h) : b.y + b.h < a.y ? a.y - (b.y + b.h) : 0
  if (dx === 0 && dy === 0) return 0
  if (dx === 0) return dy
  if (dy === 0) return dx
  return Math.hypot(dx, dy)
}

/** Chỗ đặt chữ hàm: sát nét đồ thị, cách ô tọa độ, và không đè chữ hàm khác. */
export function formulaLabelOrigin(
  textWidth: number,
  textHeight: number,
  curve: WhiteboardPoint[],
  box: { left: number; top: number; right: number; bottom: number },
  blocked: ScreenRect[] = [],
): { x: number; y: number } {
  const tw = Math.max(8, textWidth)
  const th = Math.max(8, textHeight)
  const left = box.left
  const top = box.top
  const right = Math.max(left, box.right - tw)
  const bottom = Math.max(top, box.bottom - th)
  const samples: WhiteboardPoint[] = []
  const step = Math.max(1, Math.floor(curve.length / 28))
  for (let i = 0; i < curve.length; i += step) samples.push(curve[i])
  if (samples.length === 0) samples.push({ x: left, y: top })
  const offsets = [
    { dx: 12, dy: -th - 6 },
    { dx: 12, dy: 8 },
    { dx: -tw - 12, dy: -th - 6 },
    { dx: -tw - 12, dy: 8 },
    { dx: 16, dy: -th / 2 },
    { dx: -tw - 16, dy: -th / 2 },
  ]
  let best = { x: left, y: top }
  let bestScore = -Infinity
  const pointStep = Math.max(1, Math.floor(curve.length / 80))
  const gap = 10
  for (const sample of samples) {
    for (const offset of offsets) {
      const x = Math.min(right, Math.max(left, sample.x + offset.dx))
      const y = Math.min(bottom, Math.max(top, sample.y + offset.dy))
      const rect = { x: x - 2, y: y - 2, w: tw + 4, h: th + 4 }
      let clearance = 240
      for (let i = 0; i < curve.length; i += pointStep) {
        const p = curve[i]
        const dx = p.x < rect.x ? rect.x - p.x : p.x > rect.x + rect.w ? p.x - (rect.x + rect.w) : 0
        const dy = p.y < rect.y ? rect.y - p.y : p.y > rect.y + rect.h ? p.y - (rect.y + rect.h) : 0
        const dist = dx === 0 && dy === 0 ? 0 : Math.hypot(dx, dy)
        if (dist < clearance) clearance = dist
      }
      const onInk = clearance < 6 ? (6 - clearance) * 80 : 0
      const tooFar = clearance > 36 ? (clearance - 36) * 6 : 0
      let crowd = 0
      for (const block of blocked) {
        const space = rectGap(rect, block)
        if (space < gap) crowd += (gap - space) * 120
      }
      const score = 300 - onInk - tooFar - crowd
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
  _labelSlot = 0,
  peers: WhiteboardObject[] = [],
  labels?: { blocked: ScreenRect[]; taken: ScreenRect[] },
) {
  const origin = worldToScreen(obj.origin, cam, w, h)
  const scale = cam.scale || 1
  const ui = whiteboardChromeScale(scale)
  const mates = obj.frameId
    ? peers.filter((item): item is Extract<WhiteboardObject, { kind: 'graph' }> => item.kind === 'graph' && item.frameId === obj.frameId)
    : []
  const layout = mates.length >= 2
    ? sharedFrameLayout(mates.map((item) => ({ axis: item.axis, expr: item.expr, unit: item.unit })), scale, w, h)
    : { span: visibleAxisSpan(obj.unit * scale, w, h), unit: obj.unit }
  const unit = layout.unit * scale
  const span = layout.span
  const tick = axisTickStep(unit)
  const last = Math.max(tick, Math.floor((span + 1e-6) / tick) * tick)
  const stem = Math.max(26 * ui, Math.min(unit * 0.55, 40 * ui))
  const xLast = { x: origin.x + last * unit, y: origin.y }
  const xEnd = { x: xLast.x + stem, y: origin.y }
  const xStart = { x: origin.x - last * unit - stem, y: origin.y }
  const yLast = { x: origin.x, y: origin.y - last * unit }
  const yEnd = { x: origin.x, y: yLast.y - stem }
  const yStart = { x: origin.x, y: origin.y + last * unit + stem }
  const fontPx = Math.max(10 * ui, Math.min(13 * ui, unit * 0.32))
  const axisInk = 'rgba(15,23,42,0.86)'
  if (axes) {
  ctx.strokeStyle = 'rgba(15,23,42,0.78)'
  ctx.fillStyle = axisInk
  ctx.lineWidth = 1.35 * ui
  line(ctx, xStart, xEnd)
  line(ctx, yStart, yEnd)
  ctx.fillStyle = axisInk
  drawAxisArrow(ctx, xLast, xEnd, ui)
  drawAxisArrow(ctx, yLast, yEnd, ui)
  drawInfinityMark(ctx, xEnd.x + 16 * ui, xEnd.y, axisInk, '+∞', ui)
  drawInfinityMark(ctx, xStart.x - 16 * ui, xStart.y, axisInk, '−∞', ui)
  drawInfinityMark(ctx, yEnd.x, yEnd.y - 14 * ui, axisInk, '+∞', ui)
  drawInfinityMark(ctx, yStart.x, yStart.y + 14 * ui, axisInk, '−∞', ui)

  ctx.font = `${fontPx}px ui-sans-serif, system-ui`
  ctx.fillStyle = 'rgba(15,23,42,0.88)'
  for (let n = -last; n <= last + 1e-6; n += tick) {
    if (Math.abs(n) < 1e-6) continue
    const sx = origin.x + n * unit
    const sy = origin.y - n * unit
    ctx.beginPath()
    ctx.moveTo(sx, origin.y - 4 * ui)
    ctx.lineTo(sx, origin.y + 4 * ui)
    ctx.moveTo(origin.x - 4 * ui, sy)
    ctx.lineTo(origin.x + 4 * ui, sy)
    ctx.stroke()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(formatAxisNumber(n), sx, origin.y + 6 * ui)
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ctx.fillText(formatAxisNumber(n), origin.x - 7 * ui, sy)
  }
  ctx.textAlign = 'right'
  ctx.textBaseline = 'top'
  ctx.fillText('0', origin.x - 7 * ui, origin.y + 6 * ui)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'bottom'
  ctx.fillText('x', xLast.x + 4 * ui, origin.y - 14 * ui)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'bottom'
  ctx.fillText('y', origin.x + 12 * ui, yLast.y + 2 * ui)
  }

  const parsed = parsePlotInput(obj.axis === 'y' ? `y=${obj.expr}` : `x=${obj.expr}`)
  let curveScreen: WhiteboardPoint[] = []
  if (parsed) {
    const runs = plotRuns(parsed, span, 360)
    ctx.strokeStyle = obj.color
    ctx.lineWidth = Math.max(1.6 * ui, 2 * scale)
    for (const run of runs) {
      const screen = screenPts(run.points.map((p) => mathToWorld(p, obj.origin, layout.unit)), cam, w, h)
      poly(ctx, screen, false)
      curveScreen.push(...screen)
      const math = run.points
      if (run.infiniteStart && screen.length >= 2 && math.length >= 2) {
        const at = infinityAnchor(screen[0], screen[1], w, h, ui)
        const back = math[Math.min(3, math.length - 1)]
        if (at) drawInfinityMark(ctx, at.x, at.y, obj.color, infinitySignLabel(math[0].x - back.x, math[0].y - back.y), ui)
      }
      if (run.infiniteEnd && screen.length >= 2 && math.length >= 2) {
        const at = infinityAnchor(screen[screen.length - 1], screen[screen.length - 2], w, h, ui)
        const back = math[Math.max(0, math.length - 4)]
        const tip = math[math.length - 1]
        if (at) drawInfinityMark(ctx, at.x, at.y, obj.color, infinitySignLabel(tip.x - back.x, tip.y - back.y), ui)
      }
    }

    const lang = typeof document !== 'undefined' ? document.documentElement.lang || 'vi' : 'vi'
    const extrema = labelPlotExtrema(parsed, -span, span, lang)
    const mark = extremaMarkerColor(obj.color)
    const r = Math.max(3.6 * ui, 4.4 * scale)
    const labelPx = Math.max(11 * ui, fontPx)
    for (const ext of extrema) {
      if (Math.abs(ext.x) > span + 1e-6 || Math.abs(ext.y) > span + 1e-6) continue
      const s = worldToScreen(mathToWorld(ext, obj.origin, layout.unit), cam, w, h)
      ctx.beginPath()
      ctx.fillStyle = '#fff'
      ctx.arc(s.x, s.y, r + 1.4 * ui, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.fillStyle = mark
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2)
      ctx.fill()
      drawExtremumLabel(ctx, s.x + r + 6 * ui, s.y - labelPx, ext.parts, mark, labelPx)
    }
  }
  const formula = obj.axis === 'y' ? `y=${obj.expr}` : `x=${obj.expr}`
  const formulaPx = Math.max(12 * ui, fontPx)
  ctx.font = `bold ${formulaPx}px ui-sans-serif, system-ui`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  const textWidth = ctx.measureText(formula).width
  const spot = formulaLabelOrigin(
    textWidth,
    formulaPx + 2,
    curveScreen,
    {
      left: Math.min(origin.x + 22 * ui, xStart.x + 8 * ui),
      top: yEnd.y + 8 * ui,
      right: Math.min(w - 8 * ui, xEnd.x - 4 * ui),
      bottom: yStart.y - formulaPx - 8 * ui,
    },
    [...(labels?.blocked ?? []), ...(labels?.taken ?? [])],
  )
  labels?.taken.push({ x: spot.x - 8, y: spot.y - 6, w: textWidth + 16, h: formulaPx + 14 })
  ctx.lineWidth = 4 * ui
  ctx.strokeStyle = '#f8fafc'
  ctx.strokeText(formula, spot.x, spot.y)
  ctx.fillStyle = obj.color
  ctx.fillText(formula, spot.x, spot.y)
}

const TEXT_FONT = 'ui-sans-serif, system-ui, sans-serif'

/** Khung nét đứt ôm đúng nét chữ đang vẽ, không lấy ô soạn. */
function textInkFrame(
  ctx: CanvasRenderingContext2D,
  obj: Extract<WhiteboardObject, { kind: 'text' }>,
  cam: WhiteboardCamera,
  w: number,
  h: number,
): { x: number; y: number; w: number; h: number } {
  const scale = cam.scale || 1
  const px = Math.max(1, obj.size * scale)
  const prev = ctx.font
  ctx.font = `${px}px ${TEXT_FONT}`
  const origin = worldToScreen({ x: obj.x, y: obj.y }, cam, w, h)
  const lines = wrapTextLines(obj.text, obj.width, obj.size)
  let ink = 0
  for (const line of lines) ink = Math.max(ink, ctx.measureText(line).width)
  ctx.font = prev
  const pad = 3
  const body = (Math.max(1, lines.length) - 1) * textLineHeight(obj.size) * scale + px
  return {
    x: origin.x - pad,
    y: origin.y - pad,
    w: Math.max(ink, px * 0.3) + pad * 2,
    h: body + pad * 2,
  }
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
  peers: WhiteboardObject[] = [],
  simTime = 0,
  labels?: { blocked: ScreenRect[]; taken: ScreenRect[] },
) {
  ctx.save()
  if (obj.kind === 'text') {
    const scale = cam.scale || 1
    const px = obj.size * scale
    ctx.font = `${px}px ${TEXT_FONT}`
    ctx.fillStyle = obj.color
    ctx.textBaseline = 'top'
    ctx.textAlign = 'left'
    const origin = worldToScreen({ x: obj.x, y: obj.y }, cam, w, h)
    const lines = wrapTextLines(obj.text, obj.width, obj.size)
    const lh = textLineHeight(obj.size) * scale
    for (let i = 0; i < lines.length; i += 1) ctx.fillText(lines[i], origin.x, origin.y + i * lh)
    if (selected) {
      ctx.setLineDash([5, 4])
      ctx.strokeStyle = '#2563eb'
      ctx.lineWidth = 1
      const box = textInkFrame(ctx, obj, cam, w, h)
      ctx.strokeRect(box.x, box.y, box.w, box.h)
    }
    ctx.restore()
    return
  }
  if (obj.kind === 'image') {
    const a = worldToScreen({ x: obj.x, y: obj.y }, cam, w, h)
    const b = worldToScreen({ x: obj.x + obj.w, y: obj.y + obj.h }, cam, w, h)
    const bw = b.x - a.x
    const bh = b.y - a.y
    const img = readyWhiteboardImage(obj.src)
    if (img) ctx.drawImage(img, a.x, a.y, bw, bh)
    else {
      ctx.fillStyle = '#e2e8f0'
      ctx.fillRect(a.x, a.y, bw, bh)
    }
    if (selected) {
      ctx.setLineDash([5, 4])
      ctx.strokeStyle = '#2563eb'
      ctx.lineWidth = 1
      ctx.strokeRect(a.x, a.y, bw, bh)
    }
    ctx.restore()
    return
  }
  if (obj.kind === 'figure') {
    drawWhiteboardFigure(ctx, obj, cam, w, h, figureClock(obj.params, simTime))
    if (selected) {
      ctx.setLineDash([5, 4])
      ctx.strokeStyle = '#2563eb'
      ctx.lineWidth = 1
      const box = selectionBox(obj, cam, w, h)
      if (box) ctx.strokeRect(box.x, box.y, box.w, box.h)
    }
    ctx.restore()
    return
  }
  if (obj.kind === 'shape' && obj.fillOnly) {
    if (obj.fill && obj.points.length >= 3) {
      const pts = screenPts(obj.points, cam, w, h)
      ctx.beginPath()
      ctx.moveTo(pts[0].x, pts[0].y)
      for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y)
      ctx.closePath()
      paintFill(ctx, obj.fill)
    }
    ctx.restore()
    return
  }
  if (obj.kind === 'shape' && obj.regionOnly) {
    if (obj.fill && obj.points.length >= 3) {
      const pts = screenPts(obj.points, cam, w, h)
      ctx.beginPath()
      ctx.moveTo(pts[0].x, pts[0].y)
      for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y)
      ctx.closePath()
      paintFill(ctx, obj.fill)
    }
    ctx.restore()
    return
  }
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = obj.color
  ctx.fillStyle = obj.color
  const eraser = obj.kind === 'stroke' && obj.tool === 'eraser'
  const scale = cam.scale || 1
  const lw = Math.max(1.2 * whiteboardChromeScale(scale), (obj.kind === 'graph' ? 2 : eraser ? obj.size * 2.4 : obj.size) * scale)
  ctx.lineWidth = lw
  if (eraser) ctx.globalCompositeOperation = 'destination-out'
  if (!eraser && (obj.kind === 'stroke' || obj.kind === 'shape')) ctx.setLineDash(whiteboardLineDash(obj.lineType, cam.scale || 1))
  if (obj.kind === 'stroke') {
    const closedFill = obj.fill && strokeIsClosed(obj) ? obj.fill : undefined
    smoothStroke(ctx, screenPts(obj.points, cam, w, h), closedFill)
  } else if (obj.kind === 'shape') {
    if (obj.shape === 'circle' && obj.cx != null && obj.cy != null && obj.r != null) {
      const c = worldToScreen({ x: obj.cx, y: obj.cy }, cam, w, h)
      ctx.beginPath()
      ctx.arc(c.x, c.y, obj.r * (cam.scale || 1), 0, Math.PI * 2)
      paintFill(ctx, obj.fill)
      ctx.stroke()
    } else if (obj.shape === 'ellipse' && obj.cx != null && obj.cy != null && obj.rx != null && obj.ry != null) {
      const c = worldToScreen({ x: obj.cx, y: obj.cy }, cam, w, h)
      ctx.beginPath()
      ctx.ellipse(c.x, c.y, obj.rx * (cam.scale || 1), obj.ry * (cam.scale || 1), obj.rotation ?? 0, 0, Math.PI * 2)
      paintFill(ctx, obj.fill)
      ctx.stroke()
    } else if (obj.shape === 'rect' && obj.points.length >= 2) {
      const a = worldToScreen(obj.points[0], cam, w, h)
      const b = worldToScreen(obj.points[1], cam, w, h)
      ctx.beginPath()
      ctx.rect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y))
      paintFill(ctx, obj.fill)
      ctx.stroke()
    } else if (obj.shape === 'arrow' && obj.points.length >= 4) {
      const pts = screenPts(obj.points, cam, w, h)
      const tip = pts[1]
      poly(ctx, [pts[0], tip], false)
      poly(ctx, [tip, pts[2]], false)
      poly(ctx, [tip, pts[3]], false)
    } else if (obj.shape === 'arrow' && obj.points.length >= 2) {
      const pts = screenPts(obj.points, cam, w, h)
      poly(ctx, pts, false)
      ctx.setLineDash([])
      drawArrowhead(ctx, pts[pts.length - 2], pts[pts.length - 1], lw)
    } else if (obj.shape === 'triangle' && obj.points.length >= 3) {
      ctx.lineJoin = 'miter'
      ctx.lineCap = 'butt'
      poly(ctx, screenPts(obj.points, cam, w, h), true, obj.fill)
      ctx.setLineDash([])
      drawTriangleVertices(ctx, obj.points, cam, w, h, obj.color, obj.triangle, obj.vertexNames)
    } else if (obj.shape === 'solid' && obj.solidEdges && obj.solidEdges.length >= 2) {
      drawSolidEdges(ctx, obj, cam, w, h)
    } else {
      if (obj.shape === 'line' || obj.shape === 'polygon') ctx.lineCap = 'butt'
      if (obj.shape === 'polygon') ctx.lineJoin = 'miter'
      const pts = screenPts(obj.points, cam, w, h)
      poly(ctx, pts, obj.shape === 'polygon', obj.shape === 'polygon' ? obj.fill : undefined)
      if (obj.quad && obj.points.length >= 4) {
        ctx.setLineDash([])
        drawQuadVertices(ctx, obj.points, cam, w, h, obj.color, obj.quad, obj.quadNames)
      }
      if (obj.triangleLine && pts.length >= 2) {
        ctx.setLineDash([])
        drawTriangleLineMark(ctx, obj.triangleLine, peers, cam, w, h, obj.color)
      }
    }
  } else if (obj.kind === 'graph') {
    drawGraph(ctx, obj, cam, w, h, axes, labelSlot, peers, labels)
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
  if (obj.kind === 'stroke' || obj.kind === 'dim') pts.push(...screenPts(obj.points, cam, w, h))
  else if (obj.kind === 'text') {
    const box = textWorldBox(obj)
    const a = worldToScreen({ x: box.minX, y: box.minY }, cam, w, h)
    const b = worldToScreen({ x: box.maxX, y: box.maxY }, cam, w, h)
    return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y }
  } else if (obj.kind === 'figure' || obj.kind === 'image') {
    const a = worldToScreen({ x: obj.x, y: obj.y }, cam, w, h)
    const b = worldToScreen({ x: obj.x + obj.w, y: obj.y + obj.h }, cam, w, h)
    return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y }
  } else if (obj.kind === 'graph') {
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
  const draftScale = cam.scale || 1
  ctx.lineWidth = Math.max(1.2 * whiteboardChromeScale(draftScale), (eraser ? draft.size * 2.4 : draft.size) * draftScale)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (!eraser) ctx.setLineDash(whiteboardLineDash(draft.lineType, cam.scale || 1))
  if (eraser) ctx.globalCompositeOperation = 'destination-out'
  smoothStroke(ctx, screenPts(draft.points, cam, w, h))
  ctx.restore()
}

const loadedImages = new Map<string, CanvasImageSource>()
const pendingImages = new Set<string>()
let onWhiteboardImageReady: (() => void) | null = null

export function setWhiteboardImageRepaint(fn: (() => void) | null) {
  onWhiteboardImageReady = fn
}

function readyWhiteboardImage(src: string): CanvasImageSource | null {
  const hit = loadedImages.get(src)
  if (hit) return hit
  if (typeof Image === 'undefined' || pendingImages.has(src)) return null
  pendingImages.add(src)
  const img = new Image()
  img.onload = () => {
    pendingImages.delete(src)
    loadedImages.set(src, img)
    onWhiteboardImageReady?.()
  }
  img.onerror = () => {
    pendingImages.delete(src)
  }
  img.src = src
  return null
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

function drawHaloText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, ui = 1) {
  ctx.save()
  ctx.lineWidth = 3 * ui
  ctx.strokeStyle = '#f8fafc'
  ctx.fillStyle = color
  ctx.strokeText(text, x, y)
  ctx.fillText(text, x, y)
  ctx.restore()
}

function drawVertexDot(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, ui = 1) {
  ctx.beginPath()
  ctx.fillStyle = '#fff'
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(1, 1.15 * ui)
  ctx.arc(x, y, 3.25 * ui, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
}

function drawTriangleVertices(
  ctx: CanvasRenderingContext2D,
  world: WhiteboardPoint[],
  cam: WhiteboardCamera,
  w: number,
  h: number,
  color: string,
  mark?: TriangleMark,
  names?: [string, string, string],
) {
  const scr = screenPts(world.slice(0, 3), cam, w, h)
  const cx = (scr[0].x + scr[1].x + scr[2].x) / 3
  const cy = (scr[0].y + scr[1].y + scr[2].y) / 3
  const sideText = mark ? [mark.ab, mark.bc, mark.ca] : ['', '', '']
  const ui = whiteboardChromeScale(cam.scale)
  ctx.save()
  ctx.font = `bold ${14 * ui}px ui-sans-serif, system-ui`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (let i = 0; i < 3; i += 1) {
    const p = scr[i]
    drawVertexDot(ctx, p.x, p.y, color, ui)
    const vx = p.x - cx
    const vy = p.y - cy
    const len = Math.hypot(vx, vy) || 1
    drawHaloText(ctx, names?.[i] || triangleVertexName(i as 0 | 1 | 2), p.x + (vx / len) * 16 * ui, p.y + (vy / len) * 16 * ui, color, ui)
    const label = sideText[i]
    if (!label) continue
    const q = scr[(i + 1) % 3]
    const mx = (p.x + q.x) / 2
    const my = (p.y + q.y) / 2
    const ox = mx - cx
    const oy = my - cy
    const olen = Math.hypot(ox, oy) || 1
    ctx.font = `bold ${12 * ui}px ui-sans-serif, system-ui`
    drawHaloText(ctx, label, mx + (ox / olen) * 14 * ui, my + (oy / olen) * 14 * ui, color, ui)
    ctx.font = `bold ${14 * ui}px ui-sans-serif, system-ui`
  }
  ctx.restore()
}

function drawQuadVertices(
  ctx: CanvasRenderingContext2D,
  world: WhiteboardPoint[],
  cam: WhiteboardCamera,
  w: number,
  h: number,
  color: string,
  mark: QuadMark,
  names?: [string, string, string, string],
) {
  const scr = screenPts(world.slice(0, 4), cam, w, h)
  const cx = (scr[0].x + scr[1].x + scr[2].x + scr[3].x) / 4
  const cy = (scr[0].y + scr[1].y + scr[2].y + scr[3].y) / 4
  const sideText = [mark.ab, mark.bc, mark.cd, mark.da]
  const letters = names ?? ['A', 'B', 'C', 'D']
  const ui = whiteboardChromeScale(cam.scale)
  ctx.save()
  ctx.font = `bold ${14 * ui}px ui-sans-serif, system-ui`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (let i = 0; i < 4; i += 1) {
    const p = scr[i]
    drawVertexDot(ctx, p.x, p.y, color, ui)
    const vx = p.x - cx
    const vy = p.y - cy
    const len = Math.hypot(vx, vy) || 1
    drawHaloText(ctx, letters[i] || 'A', p.x + (vx / len) * 16 * ui, p.y + (vy / len) * 16 * ui, color, ui)
    const label = sideText[i]
    if (!label) continue
    const q = scr[(i + 1) % 4]
    const mx = (p.x + q.x) / 2
    const my = (p.y + q.y) / 2
    const ox = mx - cx
    const oy = my - cy
    const olen = Math.hypot(ox, oy) || 1
    ctx.font = `bold ${12 * ui}px ui-sans-serif, system-ui`
    drawHaloText(ctx, label, mx + (ox / olen) * 14 * ui, my + (oy / olen) * 14 * ui, color, ui)
    ctx.font = `bold ${14 * ui}px ui-sans-serif, system-ui`
  }
  ctx.restore()
}

function unitScreen(a: WhiteboardPoint, b: WhiteboardPoint): WhiteboardPoint {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  return { x: dx / len, y: dy / len }
}

function drawTick(ctx: CanvasRenderingContext2D, at: WhiteboardPoint, tx: number, ty: number, len: number, ui = 1) {
  ctx.beginPath()
  ctx.moveTo(at.x - tx * len * ui, at.y - ty * len * ui)
  ctx.lineTo(at.x + tx * len * ui, at.y + ty * len * ui)
  ctx.stroke()
}

/** Hai gạch trên hai nửa cạnh: hai đoạn bằng nhau. */
function drawEqualTicks(ctx: CanvasRenderingContext2D, a: WhiteboardPoint, b: WhiteboardPoint, ui = 1) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const tx = -dy / len
  const ty = dx / len
  drawTick(ctx, { x: a.x + dx * 0.25, y: a.y + dy * 0.25 }, tx, ty, 6, ui)
  drawTick(ctx, { x: a.x + dx * 0.75, y: a.y + dy * 0.75 }, tx, ty, 6, ui)
}

function drawMidTick(ctx: CanvasRenderingContext2D, a: WhiteboardPoint, b: WhiteboardPoint, ui = 1) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  drawTick(ctx, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, -dy / len, dx / len, 6, ui)
}

/** Góc vuông tại chân, một cạnh dọc đường, một cạnh dọc đáy. */
function drawRightMark(ctx: CanvasRenderingContext2D, corner: WhiteboardPoint, ix: number, iy: number, jx: number, jy: number, ui = 1) {
  const s = 9 * ui
  ctx.beginPath()
  ctx.moveTo(corner.x + ix * s, corner.y + iy * s)
  ctx.lineTo(corner.x + ix * s + jx * s, corner.y + iy * s + jy * s)
  ctx.lineTo(corner.x + jx * s, corner.y + jy * s)
  ctx.stroke()
}

function drawBisectorArcs(ctx: CanvasRenderingContext2D, vertex: WhiteboardPoint, left: WhiteboardPoint, right: WhiteboardPoint, foot: WhiteboardPoint, ui = 1) {
  const ang = (to: WhiteboardPoint) => Math.atan2(to.y - vertex.y, to.x - vertex.x)
  const turn = (from: number, toward: number) => {
    let delta = toward - from
    while (delta > Math.PI) delta -= Math.PI * 2
    while (delta < -Math.PI) delta += Math.PI * 2
    const sweep = Math.sign(delta || 1) * Math.min(Math.abs(delta) * 0.62, 0.42)
    ctx.beginPath()
    ctx.arc(vertex.x, vertex.y, 16 * ui, from + sweep * 0.2, from + sweep, sweep < 0)
    ctx.stroke()
  }
  const bisector = ang(foot)
  turn(ang(left), bisector)
  turn(ang(right), bisector)
}

function parentTriangle(peers: WhiteboardObject[], id: string): Extract<WhiteboardObject, { kind: 'shape' }> | null {
  const stored = peers.find((item) => (
    item.kind === 'shape'
    && item.shape === 'triangle'
    && !item.regionOnly
    && item.id === id
    && item.points.length >= 3
  ))
  if (stored && stored.kind === 'shape') return stored
  const region = derivedTriangles(peers).find((item) => item.kind === 'shape' && item.id === id && item.points.length >= 3)
  return region && region.kind === 'shape' ? region : null
}

/** Ký hiệu trên hình: góc vuông, hai cung bằng, gạch trung điểm. Không ghi tên đường. */
function drawTriangleLineMark(
  ctx: CanvasRenderingContext2D,
  mark: TriangleLineMark,
  peers: WhiteboardObject[],
  cam: WhiteboardCamera,
  w: number,
  h: number,
  color: string,
) {
  const tri = parentTriangle(peers, mark.triangleId)
  if (!tri) return
  const toScreen = (p: WhiteboardPoint) => worldToScreen(p, cam, w, h)
  const built = triangleLinePoints(mark.role, mark.vertex, tri.points)
  if (!built) return
  const vertex = toScreen(tri.points[mark.vertex])
  const left = toScreen(tri.points[(mark.vertex + 1) % 3])
  const right = toScreen(tri.points[(mark.vertex + 2) % 3])
  const edgeMid = {
    x: (tri.points[(mark.vertex + 1) % 3].x + tri.points[(mark.vertex + 2) % 3].x) / 2,
    y: (tri.points[(mark.vertex + 1) % 3].y + tri.points[(mark.vertex + 2) % 3].y) / 2,
  }
  const foot = toScreen(mark.role === 'perp-bisector' ? edgeMid : built[1])
  const ui = whiteboardChromeScale(cam.scale)
  const draw = () => {
    if (mark.role === 'altitude') {
      const along = unitScreen(foot, vertex)
      const base = unitScreen(left, right)
      drawRightMark(ctx, foot, along.x, along.y, base.x, base.y, ui)
      return
    }
    if (mark.role === 'median') {
      drawEqualTicks(ctx, left, right, ui)
      return
    }
    if (mark.role === 'bisector') {
      drawBisectorArcs(ctx, vertex, left, right, foot, ui)
      return
    }
    if (mark.role === 'perp-bisector') {
      const base = unitScreen(left, right)
      let into = { x: -base.y, y: base.x }
      const towardX = vertex.x - foot.x
      const towardY = vertex.y - foot.y
      if (into.x * towardX + into.y * towardY < 0) into = { x: -into.x, y: -into.y }
      drawRightMark(ctx, foot, into.x, into.y, base.x, base.y, ui)
      drawEqualTicks(ctx, left, right, ui)
      return
    }
    drawMidTick(ctx, vertex, left, ui)
    drawMidTick(ctx, vertex, right, ui)
  }
  ctx.save()
  ctx.setLineDash([])
  ctx.lineJoin = 'miter'
  ctx.lineCap = 'butt'
  ctx.strokeStyle = '#f8fafc'
  ctx.lineWidth = 4.5 * ui
  draw()
  ctx.strokeStyle = color
  ctx.lineWidth = 1.6 * ui
  draw()
  ctx.restore()
}

function drawNewPointNames(
  ctx: CanvasRenderingContext2D,
  objects: WhiteboardObject[],
  cam: WhiteboardCamera,
  w: number,
  h: number,
) {
  const regions = derivedTriangles(objects)
  if (regions.length === 0) return
  const occupied: WhiteboardPoint[] = []
  for (const obj of objects) {
    if (obj.kind === 'shape' && obj.shape === 'triangle' && !obj.regionOnly && obj.points.length >= 3) {
      occupied.push(obj.points[0], obj.points[1], obj.points[2])
    }
  }
  const drawn = new Set<string>()
  const ui = whiteboardChromeScale(cam.scale)
  ctx.save()
  ctx.font = `bold ${14 * ui}px ui-sans-serif, system-ui`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const region of regions) {
    if (region.kind !== 'shape' || !region.vertexNames || region.points.length < 3) continue
    const pts = region.points
    const mid = { x: (pts[0].x + pts[1].x + pts[2].x) / 3, y: (pts[0].y + pts[1].y + pts[2].y) / 3 }
    const center = worldToScreen(mid, cam, w, h)
    for (let i = 0; i < 3; i += 1) {
      const p = pts[i]
      if (occupied.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 4)) continue
      const name = region.vertexNames[i]
      const key = `${name}:${Math.round(p.x)}:${Math.round(p.y)}`
      if (drawn.has(key)) continue
      drawn.add(key)
      const s = worldToScreen(p, cam, w, h)
      const vx = s.x - center.x
      const vy = s.y - center.y
      const len = Math.hypot(vx, vy) || 1
      drawHaloText(ctx, name, s.x + (vx / len) * 16 * ui, s.y + (vy / len) * 16 * ui, region.color, ui)
    }
  }
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
    const layout = sharedFrameLayout(list.map((item) => ({ axis: item.axis, expr: item.expr, unit: item.unit })), cam.scale || 1, w, h)
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        if (list[i].axis !== list[j].axis) continue
        const left = parsePlotInput(list[i].axis === 'y' ? `y=${list[i].expr}` : `x=${list[i].expr}`)
        const right = parsePlotInput(list[j].axis === 'y' ? `y=${list[j].expr}` : `x=${list[j].expr}`)
        if (!left || !right) continue
        const lang = typeof document !== 'undefined' ? document.documentElement.lang || 'vi' : 'vi'
        const hits = labelIntersections(left, right, -layout.span, layout.span, lang)
        hits.forEach((hit, index) => {
          if (Math.abs(hit.x) > layout.span + 1e-6 || Math.abs(hit.y) > layout.span + 1e-6) return
          if (seen.some((p) => Math.hypot(p.x - hit.x, p.y - hit.y) < 0.05)) return
          seen.push(hit)
          const s = worldToScreen(mathToWorld(hit, list[i].origin, layout.unit), cam, w, h)
          const ui = whiteboardChromeScale(cam.scale)
          ctx.save()
          drawVertexDot(ctx, s.x, s.y, color, ui)
          drawExtremumLabel(ctx, s.x + 8 * ui, s.y - (14 + index * 4) * ui, hit.parts, color, 12 * ui)
          ctx.restore()
        })
      }
    }
  }
}

function drawGeometryIntersections(
  ctx: CanvasRenderingContext2D,
  objects: WhiteboardObject[],
  cam: WhiteboardCamera,
  w: number,
  h: number,
) {
  const segs = straightSegments(objects)
  const hits: { x: number; y: number; color: string }[] = []
  for (let i = 0; i < segs.length; i += 1) {
    for (let j = i + 1; j < segs.length; j += 1) {
      const hit = segmentIntersection(segs[i].a, segs[i].b, segs[j].a, segs[j].b)
      if (!hit) continue
      if (hits.some((p) => Math.hypot(p.x - hit.x, p.y - hit.y) < 4)) continue
      hits.push({ ...hit, color: segs[i].color })
    }
  }
  const ui = whiteboardChromeScale(cam.scale)
  ctx.save()
  for (const hit of hits) {
    const s = worldToScreen(hit, cam, w, h)
    drawVertexDot(ctx, s.x, s.y, hit.color, ui)
  }
  ctx.restore()
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
    simTime?: number
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
  const labels = { blocked: coordinateLabelRects(ctx, opts.objects, opts.camera, w, h), taken: [] as ScreenRect[] }
  const live = opts.objects.map((obj) => resolveTriangleLine(obj, opts.objects))
  for (const obj of live) {
    if (obj.kind === 'image') drawObject(ctx, obj, opts.camera, w, h, false, false, 0, opts.objects, opts.simTime ?? 0)
  }
  for (const obj of live) {
    if (obj.kind === 'shape' && obj.fillOnly) drawObject(target, obj, opts.camera, w, h, false, false, 0, opts.objects, opts.simTime ?? 0)
  }
  for (const obj of live) {
    if (obj.kind === 'image') continue
    if (obj.kind === 'shape' && obj.fillOnly) continue
    if (obj.kind === 'dim') {
      drawWhiteboardDim(target, obj, opts.camera, w, h)
      continue
    }
    let axes = true
    let slot = 0
    if (obj.kind === 'graph') {
      const key = obj.frameId || obj.id
      slot = frameSeen.get(key) ?? 0
      axes = slot === 0
      frameSeen.set(key, slot + 1)
    }
    drawObject(target, obj, opts.camera, w, h, false, axes, slot, opts.objects, opts.simTime ?? 0, labels)
  }
  const draftCoversObject = opts.draft != null && opts.objects.some((obj) => obj.id === opts.draft?.id)
  if (opts.draft && !draftCoversObject) drawDraft(target, opts.draft, opts.camera, w, h)
  if (ink && inkLayer) {
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.drawImage(inkLayer, 0, 0)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  drawGeometryIntersections(ctx, live, opts.camera, w, h)
  drawSharedIntersections(ctx, opts.objects, opts.camera, w, h)
  drawNewPointNames(ctx, opts.objects, opts.camera, w, h)
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
      const box = selected
        ? selected.kind === 'text'
          ? textInkFrame(ctx, selected, opts.camera, w, h)
          : selectionBox(selected, opts.camera, w, h)
        : null
      if (box) ctx.strokeRect(box.x, box.y, box.w, box.h)
    }
    ctx.restore()
  }
  drawMeasureLabels(ctx, opts.objects, opts.camera, w, h)
}
