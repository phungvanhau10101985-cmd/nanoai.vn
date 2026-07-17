import type { BoxDimensionsMm } from './dimensions'

export const BODY_STRIP_SLOTS = ['front', 'right', 'back', 'left'] as const
export type BodyStripSlot = (typeof BODY_STRIP_SLOTS)[number]

export type BodyStripSegment = {
  slot: BodyStripSlot
  offsetMm: number
  widthMm: number
  heightMm: number
}

export function getBodyStripSegments(dimensions: BoxDimensionsMm): BodyStripSegment[] {
  const { length: L, width: W, height: H } = dimensions
  return [
    { slot: 'front', offsetMm: 0, widthMm: L, heightMm: H },
    { slot: 'right', offsetMm: L, widthMm: W, heightMm: H },
    { slot: 'back', offsetMm: L + W, widthMm: L, heightMm: H },
    { slot: 'left', offsetMm: 2 * L + W, widthMm: W, heightMm: H },
  ]
}

export function getBodyStripSizeMm(dimensions: BoxDimensionsMm) {
  return {
    widthMm: 2 * (dimensions.length + dimensions.width),
    heightMm: dimensions.height,
  }
}

