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
  /** Kiểu vuốt album trên thiệp. */
  albumLayoutId?: string
  /** Khung zoom/kéo từng ảnh album, theo thứ tự trong album. */
  albumPhotoCrops?: WeddingAlbumPhotoCrop[]
  /** Ngày, giờ, địa điểm đã tách sang từng nhà — không sao chép lại từ thiệp cũ. */
  sidePartyOwned?: boolean
  /** Điểm neo ngang ảnh chú rể, 0–100. */
  groomPhotoPositionX?: number
  /** Điểm neo dọc ảnh chú rể, 0–100. */
  groomPhotoPositionY?: number
  /** Zoom ảnh chú rể, 1–3. */
  groomPhotoScale?: number
  bridePhotoPositionX?: number
  bridePhotoPositionY?: number
  bridePhotoScale?: number
}

/** Zoom và điểm neo của một ảnh album khi hiện trên thiệp. Gắn theo vị trí trong danh sách ảnh. */
export type WeddingAlbumPhotoCrop = {
  index: number
  /** Điểm neo ngang, 0–100. */
  x: number
  /** Điểm neo dọc, 0–100. 0 = mép trên. */
  y: number
  /** Zoom 1–3. */
  scale: number
}

export type WeddingAlbumPhotoFrame = {
  x: number
  y: number
  scale: number
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

function readAlbumIndex(value: unknown): number | undefined {
  const num = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isInteger(num) || num < 0 || num > 29) return undefined
  return num
}

function readAlbumPhotoCrops(value: unknown): WeddingAlbumPhotoCrop[] | undefined {
  if (!Array.isArray(value)) return undefined
  const crops: WeddingAlbumPhotoCrop[] = []
  const seen = new Set<number>()
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const index = readAlbumIndex(row.index)
    if (index === undefined || seen.has(index)) continue
    seen.add(index)
    crops.push({
      index,
      x: readPercent(row.x) ?? 50,
      y: readPercent(row.y) ?? 0,
      scale: readScale(row.scale) ?? 1,
    })
  }
  return crops
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
      albumLayoutId: typeof obj.albumLayoutId === 'string' ? obj.albumLayoutId.trim() : undefined,
      albumPhotoCrops: readAlbumPhotoCrops(obj.albumPhotoCrops),
      sidePartyOwned: obj.sidePartyOwned === true,
      groomPhotoPositionX: readPercent(obj.groomPhotoPositionX),
      groomPhotoPositionY: readPercent(obj.groomPhotoPositionY),
      groomPhotoScale: readScale(obj.groomPhotoScale),
      bridePhotoPositionX: readPercent(obj.bridePhotoPositionX),
      bridePhotoPositionY: readPercent(obj.bridePhotoPositionY),
      bridePhotoScale: readScale(obj.bridePhotoScale),
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
  if (config.albumLayoutId?.trim()) payload.albumLayoutId = config.albumLayoutId.trim()
  const albumPhotoCrops = (config.albumPhotoCrops ?? [])
    .map((item) => ({
      index: readAlbumIndex(item.index),
      x: readPercent(item.x) ?? 50,
      y: readPercent(item.y) ?? 0,
      scale: readScale(item.scale) ?? 1,
    }))
    .filter((item): item is WeddingAlbumPhotoCrop => item.index !== undefined)
    .slice(0, 30)
  if (albumPhotoCrops.length > 0) payload.albumPhotoCrops = albumPhotoCrops
  if (config.sidePartyOwned) payload.sidePartyOwned = true
  writePortraitCrop(payload, 'groom', config)
  writePortraitCrop(payload, 'bride', config)
  return JSON.stringify(payload)
}

const PORTRAIT_PHOTO_DEFAULT: WeddingAlbumPhotoFrame = { x: 50, y: 18, scale: 1 }

function portraitCropKeys(side: 'groom' | 'bride') {
  return side === 'groom'
    ? (['groomPhotoPositionX', 'groomPhotoPositionY', 'groomPhotoScale'] as const)
    : (['bridePhotoPositionX', 'bridePhotoPositionY', 'bridePhotoScale'] as const)
}

function isDefaultPortraitFrame(frame: WeddingAlbumPhotoFrame) {
  return (
    frame.x === PORTRAIT_PHOTO_DEFAULT.x &&
    frame.y === PORTRAIT_PHOTO_DEFAULT.y &&
    frame.scale === PORTRAIT_PHOTO_DEFAULT.scale
  )
}

function writePortraitCrop(payload: WeddingSectionConfig, side: 'groom' | 'bride', config: WeddingSectionConfig) {
  const [xKey, yKey, scaleKey] = portraitCropKeys(side)
  if (config[xKey] === undefined && config[yKey] === undefined && config[scaleKey] === undefined) return
  const frame: WeddingAlbumPhotoFrame = {
    x: readPercent(config[xKey]) ?? PORTRAIT_PHOTO_DEFAULT.x,
    y: readPercent(config[yKey]) ?? PORTRAIT_PHOTO_DEFAULT.y,
    scale: readScale(config[scaleKey]) ?? PORTRAIT_PHOTO_DEFAULT.scale,
  }
  if (isDefaultPortraitFrame(frame)) return
  payload[xKey] = frame.x
  payload[yKey] = frame.y
  payload[scaleKey] = frame.scale
}

/** Ảnh chân dung chưa căn: mặt ở khoảng 18% từ mép trên, zoom 1. */
export function resolvePortraitPhotoFrame(
  config: WeddingSectionConfig,
  side: 'groom' | 'bride',
): WeddingAlbumPhotoFrame {
  const [xKey, yKey, scaleKey] = portraitCropKeys(side)
  return {
    x: readPercent(config[xKey]) ?? PORTRAIT_PHOTO_DEFAULT.x,
    y: readPercent(config[yKey]) ?? PORTRAIT_PHOTO_DEFAULT.y,
    scale: readScale(config[scaleKey]) ?? PORTRAIT_PHOTO_DEFAULT.scale,
  }
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

/** Ảnh chưa căn: giữ mép trên, zoom 1 — đúng cách album đang hiện. */
export function defaultAlbumPhotoFrame(): WeddingAlbumPhotoFrame {
  return { x: 50, y: 0, scale: 1 }
}

export function resolveAlbumPhotoFrame(
  crops: WeddingAlbumPhotoCrop[] | undefined,
  index: number,
): WeddingAlbumPhotoFrame {
  const hit = crops?.find((item) => item.index === index)
  if (!hit) return defaultAlbumPhotoFrame()
  return {
    x: readPercent(hit.x) ?? 50,
    y: readPercent(hit.y) ?? 0,
    scale: readScale(hit.scale) ?? 1,
  }
}

export function albumPhotoFrameStyle(frame: WeddingAlbumPhotoFrame): {
  objectPosition: string
  transform: string
  transformOrigin: string
} {
  const x = readPercent(frame.x) ?? 50
  const y = readPercent(frame.y) ?? 0
  const scale = readScale(frame.scale) ?? 1
  const objectPosition = `${x}% ${y}%`
  return {
    objectPosition,
    transform: scale === 1 ? 'none' : `scale(${scale})`,
    transformOrigin: objectPosition,
  }
}

function normalizeAlbumFrame(frame: WeddingAlbumPhotoFrame): WeddingAlbumPhotoFrame {
  return {
    x: readPercent(frame.x) ?? 50,
    y: readPercent(frame.y) ?? 0,
    scale: readScale(frame.scale) ?? 1,
  }
}

function isDefaultAlbumFrame(frame: WeddingAlbumPhotoFrame) {
  return frame.x === 50 && frame.y === 0 && frame.scale === 1
}

export function upsertAlbumPhotoCrop(
  crops: WeddingAlbumPhotoCrop[] | undefined,
  index: number,
  frame: WeddingAlbumPhotoFrame,
): WeddingAlbumPhotoCrop[] {
  const safeIndex = readAlbumIndex(index)
  const rest = (crops ?? []).filter((item) => item.index !== index)
  if (safeIndex === undefined) return rest
  const nextFrame = normalizeAlbumFrame(frame)
  if (isDefaultAlbumFrame(nextFrame)) return rest
  return [...rest, { index: safeIndex, ...nextFrame }]
}

/** Xóa ảnh tại `index` rồi dịch khung của các ảnh phía sau lên. */
export function shiftAlbumPhotoCropsAfterRemove(
  crops: WeddingAlbumPhotoCrop[] | undefined,
  index: number,
): WeddingAlbumPhotoCrop[] {
  return (crops ?? []).flatMap((item) => {
    if (item.index === index) return []
    if (item.index > index) return [{ ...item, index: item.index - 1 }]
    return [item]
  })
}

/** Giữ khung theo URL khi khách sửa danh sách ảnh (đổi thứ tự hoặc xóa dòng). */
export function remapAlbumPhotoCrops(
  previousUrls: string[],
  crops: WeddingAlbumPhotoCrop[] | undefined,
  nextUrls: string[],
): WeddingAlbumPhotoCrop[] {
  const byUrl = new Map<string, WeddingAlbumPhotoFrame>()
  for (const crop of crops ?? []) {
    const url = previousUrls[crop.index]
    if (!url || byUrl.has(url)) continue
    byUrl.set(url, { x: crop.x, y: crop.y, scale: crop.scale })
  }
  const next: WeddingAlbumPhotoCrop[] = []
  nextUrls.forEach((url, index) => {
    const frame = byUrl.get(url)
    if (!frame || isDefaultAlbumFrame(frame)) return
    next.push({ index, ...frame })
  })
  return next
}
