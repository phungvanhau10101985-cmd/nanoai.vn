import {
  DEFAULT_PAPER_STOCK,
  isPaperStockId,
  paperStockThicknessMm,
  type PaperStockId,
} from '@/lib/packaging/paper-stock'

export type TuckBoxProductionParams = {
  bleedMm: number
  glueTabMm: number
  paperThicknessMm: number
  compensationGapMm: number
  paperStock: PaperStockId
  /** Khoét ngón tay trên lưỡi gài. */
  fingerNotch: boolean
  /** Khe khóa, bo góc lưỡi gài, vai khóa trên tai bụi. */
  lockDetails: boolean
  /** Vùng an toàn cách mép cắt, mm. */
  safeZoneMm: number
  insertCols: number
  insertRows: number
  /** 0 = tự chia theo lòng hộp. */
  jarDiameterMm: number
}

const NUMERIC_KEYS = [
  'bleedMm',
  'glueTabMm',
  'paperThicknessMm',
  'compensationGapMm',
  'safeZoneMm',
  'insertCols',
  'insertRows',
  'jarDiameterMm',
] as const

type NumericProductionKey = (typeof NUMERIC_KEYS)[number]

export const TUCK_BOX_PRODUCTION_RANGES: Record<NumericProductionKey, { min: number; max: number }> = {
  bleedMm: { min: 3, max: 5 },
  glueTabMm: { min: 12, max: 20 },
  paperThicknessMm: { min: 0.2, max: 1.2 },
  compensationGapMm: { min: 0, max: 3 },
  safeZoneMm: { min: 3, max: 5 },
  insertCols: { min: 1, max: 6 },
  insertRows: { min: 1, max: 6 },
  jarDiameterMm: { min: 0, max: 120 },
}

export function defaultTuckBoxProductionParams(heightMm: number): TuckBoxProductionParams {
  return {
    bleedMm: 3,
    glueTabMm: Math.max(12, Math.min(20, Math.round(heightMm * 0.3 * 10) / 10)),
    paperThicknessMm: paperStockThicknessMm(DEFAULT_PAPER_STOCK),
    compensationGapMm: 1,
    paperStock: DEFAULT_PAPER_STOCK,
    fingerNotch: true,
    lockDetails: true,
    safeZoneMm: 4,
    insertCols: 2,
    insertRows: 3,
    jarDiameterMm: 0,
  }
}

function roundMm(n: number): number {
  return Math.round(n * 100) / 100
}

export function normalizeTuckBoxProductionParams(
  value: Partial<TuckBoxProductionParams> | null | undefined,
  heightMm: number
): TuckBoxProductionParams {
  const defaults = defaultTuckBoxProductionParams(heightMm)
  const out: TuckBoxProductionParams = { ...defaults, ...(value ?? {}) }
  for (const key of NUMERIC_KEYS) {
    const range = TUCK_BOX_PRODUCTION_RANGES[key]
    const n = Number(out[key])
    out[key] =
      Number.isFinite(n) && n >= range.min && n <= range.max ? roundMm(n) : defaults[key]
  }
  const requestedStock = value?.paperStock
  if (requestedStock && isPaperStockId(requestedStock) && requestedStock !== 'custom') {
    out.paperStock = requestedStock
    out.paperThicknessMm = paperStockThicknessMm(requestedStock)
  } else if (requestedStock === 'custom' || (value != null && value.paperThicknessMm != null && !value.paperStock)) {
    out.paperStock = 'custom'
  } else {
    out.paperStock = DEFAULT_PAPER_STOCK
    out.paperThicknessMm = paperStockThicknessMm(DEFAULT_PAPER_STOCK)
  }
  out.fingerNotch = value?.fingerNotch === undefined ? defaults.fingerNotch : Boolean(value.fingerNotch)
  out.lockDetails = value?.lockDetails === undefined ? defaults.lockDetails : Boolean(value.lockDetails)
  out.insertCols = Math.round(out.insertCols)
  out.insertRows = Math.round(out.insertRows)
  return out
}

export function validateTuckBoxProductionParams(
  value: TuckBoxProductionParams
): Partial<Record<NumericProductionKey, 'range'>> {
  const errors: Partial<Record<NumericProductionKey, 'range'>> = {}
  for (const key of NUMERIC_KEYS) {
    const range = TUCK_BOX_PRODUCTION_RANGES[key]
    if (!Number.isFinite(value[key]) || value[key] < range.min || value[key] > range.max) {
      errors[key] = 'range'
    }
  }
  return errors
}
