export type TuckBoxProductionParams = {
  bleedMm: number
  glueTabMm: number
  paperThicknessMm: number
  compensationGapMm: number
}

export const TUCK_BOX_PRODUCTION_RANGES = {
  bleedMm: { min: 0, max: 10 },
  glueTabMm: { min: 8, max: 40 },
  paperThicknessMm: { min: 0.1, max: 2 },
  compensationGapMm: { min: 0, max: 3 },
} as const

export function defaultTuckBoxProductionParams(heightMm: number): TuckBoxProductionParams {
  return {
    bleedMm: 3,
    glueTabMm: Math.max(15, Math.min(25, heightMm * 0.3)),
    paperThicknessMm: 0.4,
    compensationGapMm: 0.5,
  }
}

export function normalizeTuckBoxProductionParams(
  value: Partial<TuckBoxProductionParams> | null | undefined,
  heightMm: number
): TuckBoxProductionParams {
  const defaults = defaultTuckBoxProductionParams(heightMm)
  const out = { ...defaults, ...(value ?? {}) }
  for (const key of Object.keys(TUCK_BOX_PRODUCTION_RANGES) as (keyof TuckBoxProductionParams)[]) {
    const range = TUCK_BOX_PRODUCTION_RANGES[key]
    const n = Number(out[key])
    out[key] =
      Number.isFinite(n) && n >= range.min && n <= range.max
        ? Math.round(n * 100) / 100
        : defaults[key]
  }
  return out
}

export function validateTuckBoxProductionParams(
  value: TuckBoxProductionParams
): Partial<Record<keyof TuckBoxProductionParams, 'range'>> {
  const errors: Partial<Record<keyof TuckBoxProductionParams, 'range'>> = {}
  for (const key of Object.keys(TUCK_BOX_PRODUCTION_RANGES) as (keyof TuckBoxProductionParams)[]) {
    const range = TUCK_BOX_PRODUCTION_RANGES[key]
    if (!Number.isFinite(value[key]) || value[key] < range.min || value[key] > range.max) {
      errors[key] = 'range'
    }
  }
  return errors
}
