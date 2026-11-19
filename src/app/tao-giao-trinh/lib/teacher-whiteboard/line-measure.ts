import { dist } from './geometry'
import type { WhiteboardPoint } from './types'
import { WHITEBOARD_GRID } from './types'

/** Đưa góc về [0, 360). 0° ngang sang phải, 90° lên, 180° sang trái, 270° xuống. */
export function normalizeLineAngle(deg: number): number {
  if (!Number.isFinite(deg)) return 0
  const turns = ((deg % 360) + 360) % 360
  return turns === 0 ? 0 : turns
}

/** 0° nằm ngang sang phải, 90° hướng lên. Không có góc âm. */
export function lineMeasure(start: WhiteboardPoint, end: WhiteboardPoint): { length: number; angleDeg: number } {
  const dx = end.x - start.x
  const dy = end.y - start.y
  return {
    length: dist(start, end),
    angleDeg: normalizeLineAngle((Math.atan2(-dy, dx) * 180) / Math.PI),
  }
}

/** 1 ô lưới = 1. Số đo hiển thị theo ô, tối đa 2 chữ số thập phân. */
export function formatGridMeasure(worldPx: number, grid = WHITEBOARD_GRID): string {
  if (!Number.isFinite(worldPx)) return '0'
  const cells = worldPx / (grid || WHITEBOARD_GRID)
  const rounded = Math.round(cells * 100) / 100
  return String(Object.is(rounded, -0) ? 0 : rounded)
}

export function gridMeasureToWorld(cells: number, grid = WHITEBOARD_GRID): number {
  return cells * (grid || WHITEBOARD_GRID)
}

/** Kích thước vẽ tay làm tròn thành số nguyên, nhỏ nhất là 1. */
export function roundWhiteboardSize(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 1
  return Math.max(1, Math.round(n))
}

export function formatLineAngle(deg: number): string {
  let rounded = Math.round(normalizeLineAngle(deg) * 10) / 10
  if (rounded >= 360) rounded = 0
  return String(rounded)
}

/** Ô nhập: số nguyên. Độ dài và đường kính nhỏ nhất là 1 ô. */
export function formatWholeGrid(worldPx: number, grid = WHITEBOARD_GRID): string {
  if (!Number.isFinite(worldPx) || worldPx <= 0) return '1'
  const cells = worldPx / (grid || WHITEBOARD_GRID)
  return String(Math.max(1, Math.round(cells)))
}

/** Ô nhập góc: số nguyên trong 0–359. */
export function formatWholeAngle(deg: number): string {
  let rounded = Math.round(normalizeLineAngle(deg))
  if (rounded >= 360) rounded = 0
  return String(rounded)
}

export function parseLineAngle(raw: string): number | null {
  const text = String(raw || '').trim().replace(',', '.')
  if (!text || text.startsWith('-')) return null
  const n = Number(text)
  if (!Number.isFinite(n) || n < 0 || n > 360) return null
  return n === 360 ? 0 : n
}

/** Giữ điểm đầu. Góc theo quy ước của lineMeasure. */
export function lineFromMeasure(start: WhiteboardPoint, length: number, angleDeg: number): [WhiteboardPoint, WhiteboardPoint] {
  const rad = (angleDeg * Math.PI) / 180
  return [
    { x: start.x, y: start.y },
    { x: start.x + length * Math.cos(rad), y: start.y - length * Math.sin(rad) },
  ]
}
