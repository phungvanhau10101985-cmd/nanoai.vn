import { evalMathExpr, parseMathExpr, type MathExpr } from '../curriculum-math-expr'
import { labelIntersections } from './extrema-label'
import type { WhiteboardPoint } from './types'

export type PlotAxis = 'y' | 'x'

export type ParsedPlot = {
  axis: PlotAxis
  expr: MathExpr
  source: string
}

function stripEq(raw: string): string {
  return String(raw || '')
    .replace(/^\s*(đồ\s*thị|do\s*thi|graph|y\s*\(x\)|f\s*\(x\)|g\s*\(x\))\s*[:：-]?\s*/i, '')
    .trim()
}

export function parseSpatialInput(raw: string): string | null {
  const text = stripEq(raw).replace(/−/g, '-').replace(/,/g, '.')
  const match = text.match(/^z\s*=\s*(.+)$/i)
  if (!match) return null
  const body = match[1].trim()
  if (!body || body.length > 180) return null
  const expr = parseMathExpr(body)
  if (!expr) return null
  const value = evalMathExpr(expr, { x: 0.4, y: -0.3, pi: Math.PI, e: Math.E })
  if (value == null || !Number.isFinite(value)) return null
  return body
}

export function parsePlotInput(raw: string): ParsedPlot | null {
  const text = stripEq(raw).replace(/−/g, '-').replace(/,/g, '.')
  if (!text || text.length > 180) return null
  const eq = text.split('=')
  let axis: PlotAxis = 'y'
  let body = text
  if (eq.length >= 2) {
    const left = eq[0].replace(/\s+/g, '').toLowerCase()
    body = eq.slice(1).join('=').trim()
    if (left === 'x' || left === 'x(y)' || left === 'g(y)') axis = 'x'
    else axis = 'y'
  }
  const expr = parseMathExpr(body)
  if (!expr) return null
  const sampleVar = axis === 'y' ? 'x' : 'y'
  const probe = evalMathExpr(expr, { [sampleVar]: 1, pi: Math.PI, e: Math.E })
  if (probe == null && evalMathExpr(expr, { [sampleVar]: 0.5, pi: Math.PI, e: Math.E }) == null) return null
  return { axis, expr, source: body }
}

export function samplePlot(
  parsed: ParsedPlot,
  from: number,
  to: number,
  steps = 240,
): WhiteboardPoint[] {
  const lo = Math.min(from, to)
  const hi = Math.max(from, to)
  const n = Math.max(24, Math.min(480, steps))
  const out: WhiteboardPoint[] = []
  const variable = parsed.axis === 'y' ? 'x' : 'y'
  for (let i = 0; i <= n; i += 1) {
    const t = lo + ((hi - lo) * i) / n
    const v = evalMathExpr(parsed.expr, { [variable]: t, x: parsed.axis === 'y' ? t : 0, y: parsed.axis === 'x' ? t : 0, pi: Math.PI, e: Math.E })
    if (v == null || !Number.isFinite(v) || Math.abs(v) > 1e6) continue
    out.push(parsed.axis === 'y' ? { x: t, y: v } : { x: v, y: t })
  }
  return out
}

export type PlotRun = {
  points: WhiteboardPoint[]
  infiniteStart: boolean
  infiniteEnd: boolean
}

function outCode(x: number, y: number, span: number): number {
  let code = 0
  if (x < -span) code |= 1
  else if (x > span) code |= 2
  if (y < -span) code |= 4
  else if (y > span) code |= 8
  return code
}

function clipSegment(a: WhiteboardPoint, b: WhiteboardPoint, span: number): [WhiteboardPoint, WhiteboardPoint] | null {
  let x0 = a.x
  let y0 = a.y
  let x1 = b.x
  let y1 = b.y
  let c0 = outCode(x0, y0, span)
  let c1 = outCode(x1, y1, span)
  for (let guard = 0; guard < 8; guard += 1) {
    if ((c0 | c1) === 0) return [{ x: x0, y: y0 }, { x: x1, y: y1 }]
    if ((c0 & c1) !== 0) return null
    const c = c0 !== 0 ? c0 : c1
    let x = 0
    let y = 0
    const dx = x1 - x0
    const dy = y1 - y0
    if (c & 8) {
      x = x0 + (dx * (span - y0)) / dy
      y = span
    } else if (c & 4) {
      x = x0 + (dx * (-span - y0)) / dy
      y = -span
    } else if (c & 2) {
      y = y0 + (dy * (span - x0)) / dx
      x = span
    } else {
      y = y0 + (dy * (-span - x0)) / dx
      x = -span
    }
    if (c === c0) {
      x0 = x
      y0 = y
      c0 = outCode(x0, y0, span)
    } else {
      x1 = x
      y1 = y
      c1 = outCode(x1, y1, span)
    }
  }
  return null
}

function samePoint(a: WhiteboardPoint, b: WhiteboardPoint): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) < 1e-4
}

type ClippedRun = { points: WhiteboardPoint[]; startClipped: boolean; endClipped: boolean }

function clipPolyline(pts: WhiteboardPoint[], span: number): ClippedRun[] {
  const runs: ClippedRun[] = []
  let cur: WhiteboardPoint[] = []
  let startClipped = false
  const close = (endClipped: boolean) => {
    if (cur.length >= 2) runs.push({ points: cur, startClipped, endClipped })
    cur = []
    startClipped = false
  }
  for (let i = 0; i < pts.length - 1; i += 1) {
    const seg = clipSegment(pts[i], pts[i + 1], span)
    if (!seg) {
      close(false)
      continue
    }
    const aClipped = !samePoint(seg[0], pts[i])
    const bClipped = !samePoint(seg[1], pts[i + 1])
    if (cur.length === 0) {
      cur.push(seg[0])
      startClipped = aClipped
    } else if (!samePoint(cur[cur.length - 1], seg[0])) {
      close(true)
      cur.push(seg[0])
      startClipped = true
    }
    cur.push(seg[1])
    if (bClipped) close(true)
  }
  close(false)
  return runs
}

/** Nét đồ thị chỉ trong khung trục. Đầu nào còn đi ra ngoài khung thì đánh dấu vô cùng. */
export function plotRuns(parsed: ParsedPlot, span = PLOT_AXIS_SPAN, steps = 360): PlotRun[] {
  const n = Math.max(24, Math.min(480, steps))
  const lo = -Math.abs(span)
  const hi = Math.abs(span)
  const limit = Math.abs(span)
  const variable = parsed.axis === 'y' ? 'x' : 'y'
  type Sample = { p: WhiteboardPoint; t: number }
  const groups: Sample[][] = []
  let group: Sample[] = []
  let prev: Sample | null = null
  const flush = () => {
    if (group.length) groups.push(group)
    group = []
  }
  for (let i = 0; i <= n; i += 1) {
    const t = lo + ((hi - lo) * i) / n
    const v = evalMathExpr(parsed.expr, { [variable]: t, x: parsed.axis === 'y' ? t : 0, y: parsed.axis === 'x' ? t : 0, pi: Math.PI, e: Math.E })
    if (v == null || !Number.isFinite(v)) {
      flush()
      prev = null
      continue
    }
    const p = parsed.axis === 'y' ? { x: t, y: v } : { x: v, y: t }
    const sample = { p, t }
    if (prev && Math.hypot(p.x - prev.p.x, p.y - prev.p.y) > limit * 1.5) {
      group.push(sample)
      flush()
      group = [sample]
      prev = sample
      continue
    }
    group.push(sample)
    prev = sample
  }
  flush()
  const step = (hi - lo) / n
  const runs: PlotRun[] = []
  for (const samples of groups) {
    if (samples.length < 2) continue
    const clipped = clipPolyline(samples.map((s) => s.p), limit)
    const domainStart = samples[0].t <= lo + step + 1e-6
    const domainEnd = samples[samples.length - 1].t >= hi - step - 1e-6
    clipped.forEach((run, index) => {
      const first = index === 0
      const last = index === clipped.length - 1
      runs.push({
        points: run.points,
        infiniteStart: run.startClipped || (first && domainStart),
        infiniteEnd: run.endClipped || (last && domainEnd),
      })
    })
  }
  return runs
}

export function mathToWorld(
  p: WhiteboardPoint,
  origin: WhiteboardPoint,
  unit: number,
): WhiteboardPoint {
  const u = unit || 40
  return { x: origin.x + p.x * u, y: origin.y - p.y * u }
}

export function worldToMath(
  p: WhiteboardPoint,
  origin: WhiteboardPoint,
  unit: number,
): WhiteboardPoint {
  const u = unit || 40
  return { x: (p.x - origin.x) / u, y: (origin.y - p.y) / u }
}

export const PLOT_AXIS_SPAN = 8

/** Hướng nét đang đi: trục nào đổi nhiều hơn thì lấy dấu của trục đó. */
export function infinitySignLabel(dx: number, dy: number): '+∞' | '−∞' {
  const vertical = Math.abs(dy) >= Math.abs(dx)
  return (vertical ? dy : dx) >= 0 ? '+∞' : '−∞'
}

/** Khung trục vừa mắt: không kéo hết khổ bảng khi ô đơn vị lớn. */
export function visibleAxisSpan(unitPx: number, viewW: number, viewH: number, maxSpan = PLOT_AXIS_SPAN): number {
  const room = Math.max(96, Math.min(viewW, viewH) - 72)
  const fit = room / (2 * Math.max(unitPx, 1))
  return Math.min(maxSpan, Math.max(3, Math.round(fit)))
}

const SHARED_INTERSECTION_SEARCH = 24
const SHARED_SPAN_CAP = 16

function axisRoom(viewW: number, viewH: number): number {
  return Math.max(96, Math.min(viewW, viewH) - 72)
}

/** Cùng hệ trục thì khung phải chứa mọi giao điểm, và vẫn nằm vừa màn hình. */
export function sharedFrameLayout(
  graphs: Array<{ axis: 'x' | 'y'; expr: string; unit: number }>,
  scale: number,
  viewW: number,
  viewH: number,
): { span: number; unit: number } {
  const stored = graphs[0]?.unit || 40
  const screenUnit = stored * (scale || 1)
  const fitSpan = visibleAxisSpan(screenUnit, viewW, viewH)
  const parsed = graphs
    .map((graph) => parsePlotInput(graph.axis === 'y' ? `y=${graph.expr}` : `x=${graph.expr}`))
    .filter((item): item is ParsedPlot => item != null)
  let need = 0
  for (let i = 0; i < parsed.length; i += 1) {
    for (let j = i + 1; j < parsed.length; j += 1) {
      if (parsed[i].axis !== parsed[j].axis) continue
      const hits = labelIntersections(parsed[i], parsed[j], -SHARED_INTERSECTION_SEARCH, SHARED_INTERSECTION_SEARCH)
      for (const hit of hits) {
        need = Math.max(need, Math.abs(hit.x), Math.abs(hit.y))
      }
    }
  }
  if (need <= fitSpan) return { span: fitSpan, unit: stored }
  const span = Math.min(SHARED_SPAN_CAP, Math.max(fitSpan, Math.ceil(need + 0.75)))
  const screenFit = axisRoom(viewW, viewH) / (2 * span)
  const unit = Math.min(stored, screenFit / (scale || 1))
  return { span, unit }
}

export type PlotExtremum = {
  x: number
  y: number
  kind: 'min' | 'max'
}

export function formatAxisNumber(n: number): string {
  if (!Number.isFinite(n) || Math.abs(n) < 1e-9) return '0'
  const r = Math.round(n)
  if (Math.abs(n - r) < 1e-6) return String(r)
  const t = Math.round(n * 100) / 100
  return String(t)
}

export function axisTickStep(unitPx: number): number {
  if (unitPx < 10) return 5
  if (unitPx < 18) return 2
  return 1
}

/** Màu cực trị đậm, khác nét đồ thị. */
export function extremaMarkerColor(stroke: string): string {
  const c = (stroke || '').toLowerCase()
  if (c === '#ef4444' || c === '#dc2626' || c === '#b91c1c') return '#1e3a8a'
  if (c === '#3b82f6' || c === '#2563eb') return '#c2410c'
  if (c === '#22c55e' || c === '#16a34a') return '#9f1239'
  if (c === '#f59e0b' || c === '#d97706') return '#1d4ed8'
  return '#b91c1c'
}

export function findPlotExtrema(pts: WhiteboardPoint[], axis: PlotAxis): PlotExtremum[] {
  if (pts.length < 5) return []
  const value = (p: WhiteboardPoint) => (axis === 'y' ? p.y : p.x)
  const param = (p: WhiteboardPoint) => (axis === 'y' ? p.x : p.y)
  const raw: PlotExtremum[] = []
  for (let i = 2; i < pts.length - 2; i += 1) {
    const cur = value(pts[i])
    const prev = value(pts[i - 1])
    const next = value(pts[i + 1])
    const farL = value(pts[i - 2])
    const farR = value(pts[i + 2])
    const isMin = cur <= prev && cur <= next && cur < farL && cur < farR
    const isMax = cur >= prev && cur >= next && cur > farL && cur > farR
    if (!isMin && !isMax) continue
    raw.push({ x: pts[i].x, y: pts[i].y, kind: isMin ? 'min' : 'max' })
  }
  const merged: PlotExtremum[] = []
  for (const item of raw) {
    const last = merged[merged.length - 1]
    if (last && last.kind === item.kind && Math.abs(param(item) - param(last)) < 0.35) {
      const lastV = value(last)
      const curV = value(item)
      const better = item.kind === 'min' ? curV < lastV : curV > lastV
      if (better) merged[merged.length - 1] = item
      continue
    }
    merged.push(item)
  }
  return merged
}
