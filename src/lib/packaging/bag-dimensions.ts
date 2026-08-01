export type BagDimensionsMm = {
  /** W — front/back panel width (printable, equal on both faces) */
  width: number
  /** H — bag height (printable, equal on both faces) */
  height: number
  /** D — bag depth / gusset thickness (structural only — not printed) */
  gusset: number
}

export type ParseBagDimensionsResult =
  | { ok: true; dimensionsMm: BagDimensionsMm }
  | { ok: false; error: 'format' | 'range' }

function cmToMm(valueCm: number): number {
  return Math.round(valueCm * 10 * 100) / 100
}

function isPositiveMm(mm: number): boolean {
  return Number.isFinite(mm) && mm > 0
}

/** Parse "200×280×60 mm" or "20 × 28 × 6 cm" as W × H × depth. */
export function parseBagDimensions(input: string): ParseBagDimensionsResult {
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
  const [width, height, gusset] = values.map((n) => (inMillimeters ? n : cmToMm(n)))
  if (!isPositiveMm(width) || !isPositiveMm(height) || !isPositiveMm(gusset)) {
    return { ok: false, error: 'range' }
  }
  if (gusset >= height) return { ok: false, error: 'range' }
  return { ok: true, dimensionsMm: { width, height, gusset } }
}

export function normalizeBagDimensionsMm(raw: unknown): BagDimensionsMm | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const width = Number(o.width ?? o.widthMm)
  const height = Number(o.height ?? o.heightMm)
  const gusset = Number(o.gusset ?? o.gussetMm ?? o.depth ?? o.depthMm)
  if (!isPositiveMm(width) || !isPositiveMm(height) || !isPositiveMm(gusset)) return null
  if (gusset >= height) return null
  return { width, height, gusset }
}

export function formatBagBriefSize(locale: string, dims: BagDimensionsMm): string {
  const w = Math.round(dims.width * 10) / 10
  const h = Math.round(dims.height * 10) / 10
  const d = Math.round(dims.gusset * 10) / 10
  if (locale === 'en') return `${w} × ${h} × ${d} mm (W×H×depth)`
  return `${w} × ${h} × ${d} mm (R×C×dày)`
}

/** Printable bag panels — front and back share the same W×H. */
export type BagFaceStepKey = 'face_back' | 'face_front'

export const BAG_FACE_STEP_KEYS: BagFaceStepKey[] = ['face_back', 'face_front']

export function isBagFaceStepKey(stepKey: string | null | undefined): stepKey is BagFaceStepKey {
  return BAG_FACE_STEP_KEYS.includes(stepKey as BagFaceStepKey)
}

export function getBagFaceDimensionsMm(
  stepKey: string,
  dims: BagDimensionsMm | null | undefined
): [number, number] | null {
  if (!dims) return null
  if (stepKey === 'face_back' || stepKey === 'face_front') {
    return [dims.width, dims.height]
  }
  return null
}

export function getBagStructuralGussetMm(dims: BagDimensionsMm): number {
  return Math.min(dims.gusset, dims.height - 5)
}
