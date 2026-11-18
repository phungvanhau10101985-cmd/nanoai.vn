import type { TuckEndLayoutData } from '@/lib/packaging/box-net-svg'

/**
 * Khổ tờ hiển thị trên app. Chỉ đo dao, nếp, mặt và vùng keo.
 * Vòng tròn khoét ngón tay bị bỏ: nửa vòng nằm ngoài dao làm khổ tờ cao hơn PDF.
 */
export function dielineDisplayBounds(layout: TuckEndLayoutData): {
  minX: number
  minY: number
  widthMm: number
  heightMm: number
} {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const see = (x: number, y: number) => {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  for (const [x1, y1, x2, y2] of layout.cutSegments) {
    see(x1, y1)
    see(x2, y2)
  }
  for (const [x1, y1, x2, y2] of layout.foldSegments) {
    see(x1, y1)
    see(x2, y2)
  }
  for (const panel of layout.panels) {
    see(panel.x, panel.y)
    see(panel.x + panel.w, panel.y + panel.h)
  }
  for (const rect of [...(layout.glueRects ?? []), ...(layout.knockouts ?? []), ...(layout.overlays ?? [])]) {
    see(rect.x, rect.y)
    see(rect.x + rect.w, rect.y + rect.h)
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return { minX: 0, minY: 0, widthMm: layout.bounds.widthMm, heightMm: layout.bounds.heightMm }
  }
  return {
    minX,
    minY,
    widthMm: Math.round((maxX - minX) * 100) / 100,
    heightMm: Math.round((maxY - minY) * 100) / 100,
  }
}
