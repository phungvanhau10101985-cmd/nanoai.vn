import type { WhiteboardLineType, WhiteboardObject } from './types'
import { WHITEBOARD_LINE_TYPE_IDS } from './types'

/** Dải nét theo acad.lin, đơn vị pixel ở zoom 100%. */
export const WHITEBOARD_LINE_PATTERNS: Record<WhiteboardLineType, number[]> = {
  continuous: [],
  dashed: [14, 8],
  hidden: [8, 4],
  center: [22, 6, 5, 6],
  dashdot: [14, 5, 2, 5],
  divide: [14, 5, 2, 5, 2, 5],
  phantom: [24, 6, 6, 6, 6, 6],
  dot: [1.6, 6],
}

export function parseWhiteboardLineType(raw: unknown): WhiteboardLineType | undefined {
  if (typeof raw !== 'string') return undefined
  return WHITEBOARD_LINE_TYPE_IDS.includes(raw as WhiteboardLineType) ? raw as WhiteboardLineType : undefined
}

export function whiteboardLineDash(lineType: WhiteboardLineType | undefined, scale: number): number[] {
  const pattern = WHITEBOARD_LINE_PATTERNS[lineType && lineType in WHITEBOARD_LINE_PATTERNS ? lineType : 'continuous']
  const zoom = Math.max(0.35, scale || 1)
  return pattern.map((n) => n * zoom)
}

export function stampLineType<T extends WhiteboardObject>(object: T, lineType: WhiteboardLineType): T {
  if (object.kind === 'graph' || object.kind === 'dim' || object.kind === 'text' || object.kind === 'figure' || object.kind === 'image' || (object.kind === 'stroke' && object.tool === 'eraser')) return object
  if (object.kind === 'shape' && object.shape === 'solid') return object
  const chosen = object.lineType ?? lineType
  if (!chosen || chosen === 'continuous') {
    if (!object.lineType) return object
    const next = { ...object }
    delete next.lineType
    return next
  }
  return { ...object, lineType: chosen }
}
