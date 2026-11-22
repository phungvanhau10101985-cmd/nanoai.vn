export type Ctx = CanvasRenderingContext2D

export const INK = {
  text: '#1e293b',
  muted: '#64748b',
  blue: '#2563eb',
  green: '#059669',
  amber: '#d97706',
  red: '#dc2626',
  violet: '#7c3aed',
  sky: '#0284c7',
  glass: '#dbeafe',
  image: '#c2410c',
} as const

export function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n))
}

export function tuneAt(tune: number[] | undefined, index: number, fallback: number) {
  const value = tune?.[index]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function ink(ctx: Ctx, color: string) {
  ctx.strokeStyle = color
  ctx.fillStyle = color
}

export function textAt(ctx: Ctx, value: string, x: number, y: number, size = 13, color = '#1e293b') {
  ctx.save()
  ctx.fillStyle = color
  ctx.font = `${size}px ui-sans-serif, system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(value, x, y)
  ctx.restore()
}

export function arrow(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, head = 8) {
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  const ang = Math.atan2(y2 - y1, x2 - x1)
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - head * Math.cos(ang - 0.45), y2 - head * Math.sin(ang - 0.45))
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - head * Math.cos(ang + 0.45), y2 - head * Math.sin(ang + 0.45))
  ctx.stroke()
}

export function knob(ctx: Ctx, x: number, y: number) {
  ctx.save()
  ctx.beginPath()
  ctx.arc(x, y, 7, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = INK.sky
  ctx.lineWidth = 1.5
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

export function wrap01(value: number) {
  if (!Number.isFinite(value)) return 0
  const frac = value % 1
  return frac < 0 ? frac + 1 : frac
}

export function meterFace(ctx: Ctx, cx: number, cy: number, value: number, max: number, unit: string, color: string) {
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, 26, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = INK.text
  ctx.lineWidth = 1.6
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.strokeStyle = INK.muted
  ctx.lineWidth = 1.2
  ctx.arc(cx, cy, 16, -Math.PI * 0.75, -Math.PI * 0.25, false)
  ctx.stroke()
  const ang = -Math.PI * 0.75 + (Math.PI * 0.5) * clamp(value / max, 0, 1)
  ctx.beginPath()
  ctx.strokeStyle = color
  ctx.lineWidth = 1.8
  ctx.moveTo(cx, cy)
  ctx.lineTo(cx + Math.cos(ang) * 14, cy + Math.sin(ang) * 14)
  ctx.stroke()
  textAt(ctx, unit, cx, cy + 14, 10, color)
  ctx.restore()
}
