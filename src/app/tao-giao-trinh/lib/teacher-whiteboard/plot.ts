import { evalMathExpr, parseMathExpr, type MathExpr } from '../curriculum-math-expr'
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
