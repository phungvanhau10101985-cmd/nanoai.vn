export type PackagingFaceKey = 'LxW' | 'LxH' | 'WxH'

export type BoxDimensionsMm = {
  length: number
  width: number
  height: number
}

/** Accept `{ length, width, height }` or legacy `{ lengthMm, widthMm, heightMm }`. */
export function normalizeBoxDimensionsMm(raw: unknown): BoxDimensionsMm | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const length = Number(o.length ?? o.lengthMm)
  const width = Number(o.width ?? o.widthMm)
  const height = Number(o.height ?? o.heightMm)
  if (!Number.isFinite(length) || !Number.isFinite(width) || !Number.isFinite(height)) {
    return null
  }
  if (length <= 0 || width <= 0 || height <= 0) return null
  return { length, width, height }
}

export const BOX_MIN_MM = 20
/** Minimum height (0.5 cm) — flat/thin boxes often have a very small H. */
export const BOX_MIN_HEIGHT_MM = 5
export const BOX_MAX_MM = 500

export function cmToMm(valueCm: number): number {
  return Math.round(valueCm * 10 * 100) / 100
}

export function getFaceDimensionsMm(
  key: PackagingFaceKey,
  box: BoxDimensionsMm
): [number, number] {
  if (key === 'LxW') return [box.length, box.width]
  if (key === 'LxH') return [box.length, box.height]
  return [box.width, box.height]
}

export type ParseBoxDimensionsResult =
  | { ok: true; dimensionsMm: BoxDimensionsMm }
  | { ok: false; error: 'format' | 'range' }

/**
 * Parse "20×15×10 cm", "20 x 15 x 10", or "200×150×100 mm".
 * Decimal comma and decimal point are both accepted.
 */
export function parseBoxDimensions(input: string): ParseBoxDimensionsResult {
  const normalized = input.trim().replace(/,/g, '.')
  const match = normalized.match(
    /(\d+(?:\.\d+)?)\s*(?:x|×|\*)\s*(\d+(?:\.\d+)?)\s*(?:x|×|\*)\s*(\d+(?:\.\d+)?)/i
  )
  if (!match) return { ok: false, error: 'format' }

  const values = [Number(match[1]), Number(match[2]), Number(match[3])]
  if (values.some((n) => !Number.isFinite(n) || n <= 0)) {
    return { ok: false, error: 'format' }
  }
  const inMillimeters = /\bmm\b/i.test(normalized)
  const [length, width, height] = values.map((n) => (inMillimeters ? n : cmToMm(n)))
  if (
    length < BOX_MIN_MM ||
    length > BOX_MAX_MM ||
    width < BOX_MIN_MM ||
    width > BOX_MAX_MM ||
    height < BOX_MIN_HEIGHT_MM ||
    height > BOX_MAX_MM
  ) {
    return { ok: false, error: 'range' }
  }
  return {
    ok: true,
    dimensionsMm: { length, width, height },
  }
}

