import { INK, arrow, clamp, ink, knob, textAt, tuneAt, type Ctx } from './bench-style'
import { figureCaption, type FigureCaption } from './figure-caption'

export function say(label: FigureCaption) {
  return figureCaption(label)
}

export function C(vi: string, en: string, zh: string, ja: string, ko: string): FigureCaption {
  return [vi, en, zh, ja, ko]
}

export function bottomX(w: number, t: number) {
  return 36 + clamp(t, 0, 1) * (w - 72)
}

export function bottomT(w: number, x: number) {
  return clamp((x - 36) / Math.max(1, w - 72), 0, 1)
}

export function bottomKnob(ctx: Ctx, w: number, h: number, t: number) {
  const x = bottomX(w, t)
  const y = h - 16
  ink(ctx, INK.muted)
  ctx.beginPath()
  ctx.moveTo(36, y)
  ctx.lineTo(w - 36, y)
  ctx.stroke()
  knob(ctx, x, y)
  return { x, y }
}

export function keepTune(tune: number[] | undefined, index: number, value: number) {
  const next = [...(tune ?? [])]
  while (next.length <= index) next.push(0)
  next[index] = value
  return next
}

export function title(ctx: Ctx, w: number, label: FigureCaption) {
  textAt(ctx, say(label), w / 2, 16, 13, INK.text)
}

export function note(ctx: Ctx, w: number, h: number, label: FigureCaption) {
  textAt(ctx, say(label), w / 2, h - 34, 12, INK.muted)
}

export function box(ctx: Ctx, x: number, y: number, w: number, h: number, color = INK.text, fill?: string) {
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  if (fill) {
    ctx.fillStyle = fill
    ctx.fill()
  }
  ctx.strokeStyle = color
  ctx.stroke()
}

export function dot(ctx: Ctx, x: number, y: number, color: string, r = 4) {
  ink(ctx, color)
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}

export function arrowTo(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, color = INK.blue) {
  ink(ctx, color)
  arrow(ctx, x1, y1, x2, y2)
}

export function axes(ctx: Ctx, x0: number, y0: number, x1: number, y1: number) {
  ink(ctx, INK.text)
  arrow(ctx, x0, y0, x1, y0)
  arrow(ctx, x0, y0, x0, y1)
}

export function t0(tune: number[] | undefined, fallback = 0.45) {
  return clamp(tuneAt(tune, 0, fallback), 0, 1)
}
