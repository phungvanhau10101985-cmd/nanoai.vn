export type WeddingSectionConfig = {
  /** Layout preset for the inner cover card (not page background). */
  coverPresetId?: string
  /** Photo displayed inside the cover card center. */
  coverPhotoUrl?: string
  /** Horizontal focal point for the cover photo crop, 0-100. */
  coverPhotoPositionX?: number
  /** Vertical focal point for the cover photo crop, 0-100. */
  coverPhotoPositionY?: number
  /** Cover photo zoom scale, 1-3. */
  coverPhotoScale?: number
}

function readPercent(value: unknown): number | undefined {
  const num = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isFinite(num)) return undefined
  return Math.max(0, Math.min(100, Math.round(num)))
}

function readScale(value: unknown): number | undefined {
  const num = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isFinite(num)) return undefined
  return Math.max(1, Math.min(3, Math.round(num * 100) / 100))
}

export function parseWeddingSectionConfig(raw: string | null | undefined): WeddingSectionConfig {
  if (!raw?.trim()) return {}
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>
    const legacyCustom =
      typeof obj.customCoverUrl === 'string' ? obj.customCoverUrl.trim() : undefined
    const coverPhotoUrl =
      typeof obj.coverPhotoUrl === 'string'
        ? obj.coverPhotoUrl.trim()
        : legacyCustom
    return {
      coverPresetId: typeof obj.coverPresetId === 'string' ? obj.coverPresetId.trim() : undefined,
      coverPhotoUrl: coverPhotoUrl || undefined,
      coverPhotoPositionX: readPercent(obj.coverPhotoPositionX),
      coverPhotoPositionY: readPercent(obj.coverPhotoPositionY),
      coverPhotoScale: readScale(obj.coverPhotoScale),
    }
  } catch {
    return {}
  }
}

export function stringifyWeddingSectionConfig(config: WeddingSectionConfig): string {
  const payload: WeddingSectionConfig = {}
  if (config.coverPresetId?.trim()) payload.coverPresetId = config.coverPresetId.trim()
  if (config.coverPhotoUrl?.trim()) payload.coverPhotoUrl = config.coverPhotoUrl.trim()
  if (typeof config.coverPhotoPositionX === 'number') payload.coverPhotoPositionX = readPercent(config.coverPhotoPositionX)
  if (typeof config.coverPhotoPositionY === 'number') payload.coverPhotoPositionY = readPercent(config.coverPhotoPositionY)
  if (typeof config.coverPhotoScale === 'number') payload.coverPhotoScale = readScale(config.coverPhotoScale)
  return JSON.stringify(payload)
}

export function mergeWeddingSectionConfig(
  raw: string | null | undefined,
  patch: Partial<WeddingSectionConfig>,
): string {
  const current = parseWeddingSectionConfig(raw)
  return stringifyWeddingSectionConfig({ ...current, ...patch })
}

export function resolveCoverPhotoUrl(config: WeddingSectionConfig): string {
  return config.coverPhotoUrl?.trim() || ''
}

export function resolveCoverPhotoObjectPosition(config: WeddingSectionConfig): string {
  const x = readPercent(config.coverPhotoPositionX) ?? 50
  const y = readPercent(config.coverPhotoPositionY) ?? 50
  return `${x}% ${y}%`
}

export function resolveCoverPhotoScale(config: WeddingSectionConfig): number {
  return readScale(config.coverPhotoScale) ?? 1
}
