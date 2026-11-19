import { whiteboardChromeScale, worldToScreen } from './geometry'
import { formatGridMeasure, formatLineAngle, lineMeasure } from './line-measure'
import type { WhiteboardCamera, WhiteboardObject, WhiteboardPoint } from './types'

export type MeasureLabel = {
  id: string
  kind: 'line' | 'circle'
  text: string
  x: number
  y: number
}

function lineAnchor(a: WhiteboardPoint, b: WhiteboardPoint, ui: number): { x: number; y: number } {
  const mx = (a.x + b.x) / 2
  const my = (a.y + b.y) / 2
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  return { x: mx + (-dy / len) * 16 * ui, y: my + (dx / len) * 16 * ui }
}

export function measureLabels(
  objects: WhiteboardObject[],
  cam: WhiteboardCamera,
  w: number,
  h: number,
): MeasureLabel[] {
  const out: MeasureLabel[] = []
  const ui = whiteboardChromeScale(cam.scale)
  for (const obj of objects) {
    if (obj.kind !== 'shape') continue
    if (obj.shape === 'line' && !obj.triangleLine && obj.points.length >= 2) {
      const start = obj.points[0]
      const end = obj.points[obj.points.length - 1]
      const measured = lineMeasure(start, end)
      const anchor = lineAnchor(worldToScreen(start, cam, w, h), worldToScreen(end, cam, w, h), ui)
      out.push({
        id: obj.id,
        kind: 'line',
        text: `${formatGridMeasure(measured.length)} · ${formatLineAngle(measured.angleDeg)}°`,
        x: anchor.x,
        y: anchor.y,
      })
    } else if (obj.shape === 'circle' && obj.cx != null && obj.cy != null && obj.r != null) {
      const c = worldToScreen({ x: obj.cx, y: obj.cy }, cam, w, h)
      const rx = obj.r * (cam.scale || 1)
      out.push({
        id: obj.id,
        kind: 'circle',
        text: `Ø ${formatGridMeasure(obj.r * 2)}`,
        x: c.x + rx + 8 * ui,
        y: c.y,
      })
    }
  }
  return out
}

export function measureLabelBox(label: MeasureLabel): { x: number; y: number; w: number; h: number } {
  return { x: label.x - 3, y: label.y - 9, w: label.text.length * 6.7 + 8, h: 18 }
}

export function hitMeasureLabel(
  objects: WhiteboardObject[],
  sx: number,
  sy: number,
  cam: WhiteboardCamera,
  w: number,
  h: number,
): MeasureLabel | null {
  const labels = measureLabels(objects, cam, w, h)
  for (let i = labels.length - 1; i >= 0; i -= 1) {
    const box = measureLabelBox(labels[i])
    if (sx >= box.x && sx <= box.x + box.w && sy >= box.y && sy <= box.y + box.h) return labels[i]
  }
  return null
}

export function drawMeasureLabels(
  ctx: CanvasRenderingContext2D,
  objects: WhiteboardObject[],
  cam: WhiteboardCamera,
  w: number,
  h: number,
) {
  const labels = measureLabels(objects, cam, w, h)
  if (labels.length === 0) return
  const ui = whiteboardChromeScale(cam.scale)
  ctx.save()
  ctx.font = `600 ${12 * ui}px ui-sans-serif, system-ui`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  for (const label of labels) {
    ctx.lineWidth = 3 * ui
    ctx.strokeStyle = '#f8fafc'
    ctx.strokeText(label.text, label.x, label.y)
    ctx.fillStyle = '#0f172a'
    ctx.fillText(label.text, label.x, label.y)
  }
  ctx.restore()
}
