import { findWeddingCoverPreset } from '@/lib/wedding/wedding-cover-presets'

export type WeddingCoverAiFrameHole = { x: number; y: number; w: number; h: number }

export type WeddingCoverFrameMode = 'none' | 'preset' | 'library' | 'ai'

export type WeddingCoverPhotoOpen = 'none' | 'rise' | 'fade' | 'zoom' | 'assemble'

export type WeddingCoverFrameOpen = 'none' | 'fade' | 'bloom' | 'assemble'

/** Nở một lần ngay lúc bấm Mở thiệp. */
export type WeddingOpenBurstEffect = 'none' | 'bloom' | 'petals' | 'hearts' | 'stars' | 'fireworks' | 'gold' | 'butterflies'

/** Rơi trong lúc thiệp hiện lên. */
export type WeddingOpenFallEffect = 'none' | 'petals' | 'hearts' | 'stars' | 'fireworks' | 'gold' | 'snow' | 'confetti' | 'lanterns'

export const WEDDING_OPEN_BURST_EFFECTS: WeddingOpenBurstEffect[] = [
  'bloom',
  'petals',
  'hearts',
  'stars',
  'fireworks',
  'gold',
  'butterflies',
  'none',
]

export const WEDDING_OPEN_FALL_EFFECTS: WeddingOpenFallEffect[] = [
  'petals',
  'hearts',
  'stars',
  'fireworks',
  'gold',
  'snow',
  'confetti',
  'lanterns',
  'none',
]

/** Số giây hiệu ứng rơi. 0 = suốt lúc khách còn xem. */
export const WEDDING_OPEN_FALL_SECOND_STOPS = [5, 10, 15, 20, 30, 45, 60, 90, 120, 0] as const

export type WeddingSectionConfig = {
  /** Layout preset for the inner cover card (not page background). */
  coverPresetId?: string
  /** Photo displayed inside the cover card center. */
  coverPhotoUrl?: string
  /** Khung AI đã xóa nền. Lỗ giữa tính từ alpha. */
  coverAiFrameUrl?: string
  coverAiFrameHole?: WeddingCoverAiFrameHole
  coverAiFramePanel?: string
  coverAiFrameInk?: 'dark' | 'light'
  /** none = chỉ ảnh. preset = khung mẫu. library / ai = khung đã lưu, lồng trên chữ Thân mời. */
  coverFrameMode?: WeddingCoverFrameMode
  /** Cách ảnh trong khung hiện ra. */
  coverPhotoOpen?: WeddingCoverPhotoOpen
  /** Cách khung hiện ra. */
  coverFrameOpen?: WeddingCoverFrameOpen
  /** Hiệu ứng nở khi bấm Mở thiệp. */
  openBurstEffect?: WeddingOpenBurstEffect
  /** Hiệu ứng rơi khi thiệp lướt lên. */
  openFallEffect?: WeddingOpenFallEffect
  /** Số giây hiệu ứng rơi. 0 = suốt lúc khách còn xem. */
  openFallSeconds?: number
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
  /** Khung trang trí quanh ảnh chân dung. preset = khung mẫu. library = khung AI đã lưu. */
  groomPortraitShellMode?: 'preset' | 'library'
  groomPortraitShellPresetId?: string
  groomPortraitShellUrl?: string
  groomPortraitShellHole?: WeddingCoverAiFrameHole
  groomPortraitShellPanel?: string
  bridePortraitShellMode?: 'preset' | 'library'
  bridePortraitShellPresetId?: string
  bridePortraitShellUrl?: string
  bridePortraitShellHole?: WeddingCoverAiFrameHole
  bridePortraitShellPanel?: string
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

function readHoleNumber(value: unknown): number | undefined {
  const num = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isFinite(num)) return undefined
  return Math.max(0, Math.min(100, Math.round(num * 100) / 100))
}

const COVER_FRAME_MODES = new Set<WeddingCoverFrameMode>(['none', 'preset', 'library', 'ai'])
const COVER_PHOTO_OPENS = new Set<WeddingCoverPhotoOpen>(['none', 'rise', 'fade', 'zoom', 'assemble'])
const COVER_FRAME_OPENS = new Set<WeddingCoverFrameOpen>(['none', 'fade', 'bloom', 'assemble'])
const OPEN_BURST_EFFECTS = new Set<WeddingOpenBurstEffect>(WEDDING_OPEN_BURST_EFFECTS)
const OPEN_FALL_EFFECTS = new Set<WeddingOpenFallEffect>(WEDDING_OPEN_FALL_EFFECTS)

function readCoverFrameMode(value: unknown): WeddingCoverFrameMode | undefined {
  return typeof value === 'string' && COVER_FRAME_MODES.has(value as WeddingCoverFrameMode)
    ? (value as WeddingCoverFrameMode)
    : undefined
}

function readCoverPhotoOpen(value: unknown): WeddingCoverPhotoOpen | undefined {
  return typeof value === 'string' && COVER_PHOTO_OPENS.has(value as WeddingCoverPhotoOpen)
    ? (value as WeddingCoverPhotoOpen)
    : undefined
}

function readCoverFrameOpen(value: unknown): WeddingCoverFrameOpen | undefined {
  return typeof value === 'string' && COVER_FRAME_OPENS.has(value as WeddingCoverFrameOpen)
    ? (value as WeddingCoverFrameOpen)
    : undefined
}

function readOpenBurstEffect(value: unknown): WeddingOpenBurstEffect | undefined {
  return typeof value === 'string' && OPEN_BURST_EFFECTS.has(value as WeddingOpenBurstEffect)
    ? (value as WeddingOpenBurstEffect)
    : undefined
}

function readOpenFallEffect(value: unknown): WeddingOpenFallEffect | undefined {
  return typeof value === 'string' && OPEN_FALL_EFFECTS.has(value as WeddingOpenFallEffect)
    ? (value as WeddingOpenFallEffect)
    : undefined
}

function readOpenFallSeconds(value: unknown): number | undefined {
  const num = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isFinite(num)) return undefined
  if (num <= 0) return 0
  let best: number = WEDDING_OPEN_FALL_SECOND_STOPS[0]
  let bestDist = Infinity
  for (const stop of WEDDING_OPEN_FALL_SECOND_STOPS) {
    if (stop === 0) continue
    const dist = Math.abs(stop - num)
    if (dist < bestDist) {
      best = stop
      bestDist = dist
    }
  }
  return best
}

function readCoverAiFrameHole(value: unknown): WeddingCoverAiFrameHole | undefined {
  if (!value || typeof value !== 'object') return undefined
  const row = value as Record<string, unknown>
  const x = readHoleNumber(row.x)
  const y = readHoleNumber(row.y)
  const w = readHoleNumber(row.w)
  const h = readHoleNumber(row.h)
  if (x === undefined || y === undefined || w === undefined || h === undefined) return undefined
  if (w < 18 || h < 18) return undefined
  if (x + w > 100.5 || y + h > 100.5) return undefined
  return { x, y, w, h }
}

function readCoverAiFramePanel(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const color = value.trim()
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : undefined
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
      coverAiFrameUrl: typeof obj.coverAiFrameUrl === 'string' ? obj.coverAiFrameUrl.trim() || undefined : undefined,
      coverAiFrameHole: readCoverAiFrameHole(obj.coverAiFrameHole),
      coverAiFramePanel: readCoverAiFramePanel(obj.coverAiFramePanel),
      coverAiFrameInk: obj.coverAiFrameInk === 'light' || obj.coverAiFrameInk === 'dark' ? obj.coverAiFrameInk : undefined,
      coverFrameMode: readCoverFrameMode(obj.coverFrameMode),
      coverPhotoOpen: readCoverPhotoOpen(obj.coverPhotoOpen),
      coverFrameOpen: readCoverFrameOpen(obj.coverFrameOpen),
      openBurstEffect: readOpenBurstEffect(obj.openBurstEffect),
      openFallEffect: readOpenFallEffect(obj.openFallEffect),
      openFallSeconds: readOpenFallSeconds(obj.openFallSeconds),
      albumLayoutId: typeof obj.albumLayoutId === 'string' ? obj.albumLayoutId.trim() : undefined,
      albumPhotoCrops: readAlbumPhotoCrops(obj.albumPhotoCrops),
      sidePartyOwned: obj.sidePartyOwned === true,
      groomPhotoPositionX: readPercent(obj.groomPhotoPositionX),
      groomPhotoPositionY: readPercent(obj.groomPhotoPositionY),
      groomPhotoScale: readScale(obj.groomPhotoScale),
      bridePhotoPositionX: readPercent(obj.bridePhotoPositionX),
      bridePhotoPositionY: readPercent(obj.bridePhotoPositionY),
      bridePhotoScale: readScale(obj.bridePhotoScale),
      ...readPortraitShell(obj, 'groom'),
      ...readPortraitShell(obj, 'bride'),
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
  const aiFrameUrl = config.coverAiFrameUrl?.trim()
  const aiFrameHole = readCoverAiFrameHole(config.coverAiFrameHole)
  if (aiFrameUrl && aiFrameHole) {
    payload.coverAiFrameUrl = aiFrameUrl
    payload.coverAiFrameHole = aiFrameHole
    payload.coverAiFramePanel = readCoverAiFramePanel(config.coverAiFramePanel) || '#fffaf2'
    payload.coverAiFrameInk = config.coverAiFrameInk === 'light' ? 'light' : 'dark'
  }
  const frameMode = readCoverFrameMode(config.coverFrameMode)
  if (frameMode) payload.coverFrameMode = frameMode
  const photoOpen = readCoverPhotoOpen(config.coverPhotoOpen)
  if (photoOpen) payload.coverPhotoOpen = photoOpen
  const frameOpen = readCoverFrameOpen(config.coverFrameOpen)
  if (frameOpen) payload.coverFrameOpen = frameOpen
  const openBurst = readOpenBurstEffect(config.openBurstEffect)
  if (openBurst) payload.openBurstEffect = openBurst
  const openFall = readOpenFallEffect(config.openFallEffect)
  if (openFall) payload.openFallEffect = openFall
  const openFallSeconds = readOpenFallSeconds(config.openFallSeconds)
  if (openFallSeconds !== undefined) payload.openFallSeconds = openFallSeconds
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
  writePortraitShell(payload, 'groom', config)
  writePortraitShell(payload, 'bride', config)
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

export type WeddingPortraitShellFrame = {
  src: string
  hole: WeddingCoverAiFrameHole
  panel: string
}

function portraitShellKeys(side: 'groom' | 'bride') {
  return side === 'groom'
    ? (['groomPortraitShellMode', 'groomPortraitShellPresetId', 'groomPortraitShellUrl', 'groomPortraitShellHole', 'groomPortraitShellPanel'] as const)
    : (['bridePortraitShellMode', 'bridePortraitShellPresetId', 'bridePortraitShellUrl', 'bridePortraitShellHole', 'bridePortraitShellPanel'] as const)
}

function readPortraitShellMode(value: unknown): 'preset' | 'library' | undefined {
  return value === 'preset' || value === 'library' ? value : undefined
}

function readPortraitShell(obj: Record<string, unknown>, side: 'groom' | 'bride'): Partial<WeddingSectionConfig> {
  const [modeKey, presetKey, urlKey, holeKey, panelKey] = portraitShellKeys(side)
  const mode = readPortraitShellMode(obj[modeKey])
  if (mode === 'preset') {
    const presetId = typeof obj[presetKey] === 'string' ? obj[presetKey].trim() : ''
    if (!presetId || !findWeddingCoverPreset(presetId)?.frame) return {}
    return { [modeKey]: 'preset', [presetKey]: presetId }
  }
  if (mode === 'library') {
    const url = typeof obj[urlKey] === 'string' ? obj[urlKey].trim() : ''
    const hole = readCoverAiFrameHole(obj[holeKey])
    if (!url || !hole) return {}
    return {
      [modeKey]: 'library',
      [urlKey]: url,
      [holeKey]: hole,
      [panelKey]: readCoverAiFramePanel(obj[panelKey]) || '#fffaf2',
    }
  }
  return {}
}

function writePortraitShell(payload: WeddingSectionConfig, side: 'groom' | 'bride', config: WeddingSectionConfig) {
  const [modeKey, presetKey, urlKey, holeKey, panelKey] = portraitShellKeys(side)
  const mode = readPortraitShellMode(config[modeKey])
  if (mode === 'preset') {
    const presetId = config[presetKey]?.trim()
    if (!presetId || !findWeddingCoverPreset(presetId)?.frame) return
    payload[modeKey] = 'preset'
    payload[presetKey] = presetId
    return
  }
  if (mode === 'library') {
    const url = config[urlKey]?.trim()
    const hole = readCoverAiFrameHole(config[holeKey])
    if (!url || !hole) return
    payload[modeKey] = 'library'
    payload[urlKey] = url
    payload[holeKey] = hole
    payload[panelKey] = readCoverAiFramePanel(config[panelKey]) || '#fffaf2'
  }
}

/** Khung trang trí của ảnh chú rể hoặc cô dâu. Không có thì ảnh đứng trần. */
export function resolvePortraitShell(
  config: WeddingSectionConfig,
  side: 'groom' | 'bride',
): WeddingPortraitShellFrame | null {
  const [modeKey, presetKey, urlKey, holeKey, panelKey] = portraitShellKeys(side)
  const mode = readPortraitShellMode(config[modeKey])
  if (mode === 'preset') {
    const frame = findWeddingCoverPreset(config[presetKey] ?? '')?.frame
    if (!frame) return null
    return { src: frame.src, hole: frame.hole, panel: frame.panel }
  }
  if (mode === 'library') {
    const src = config[urlKey]?.trim()
    const hole = readCoverAiFrameHole(config[holeKey])
    if (!src || !hole) return null
    return { src, hole, panel: readCoverAiFramePanel(config[panelKey]) || '#fffaf2' }
  }
  return null
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

/** Khung AI đã lưu. Thiếu URL hoặc lỗ thì vỏ mẫu thắng. */
export function resolveCoverAiFrame(config: WeddingSectionConfig): {
  src: string
  hole: WeddingCoverAiFrameHole
  panel: string
  ink: 'dark' | 'light'
} | null {
  const src = config.coverAiFrameUrl?.trim()
  const hole = readCoverAiFrameHole(config.coverAiFrameHole)
  if (!src || !hole) return null
  return {
    src,
    hole,
    panel: readCoverAiFramePanel(config.coverAiFramePanel) || '#fffaf2',
    ink: config.coverAiFrameInk === 'light' ? 'light' : 'dark',
  }
}

export function resolveCoverFrameMode(config: WeddingSectionConfig): WeddingCoverFrameMode | undefined {
  const mode = readCoverFrameMode(config.coverFrameMode)
  if (mode) return mode
  if (config.coverAiFrameUrl?.trim() && readCoverAiFrameHole(config.coverAiFrameHole)) return 'ai'
  return undefined
}

export function resolveCoverPhotoOpen(config: WeddingSectionConfig): WeddingCoverPhotoOpen {
  return readCoverPhotoOpen(config.coverPhotoOpen) ?? 'rise'
}

export function resolveCoverFrameOpen(config: WeddingSectionConfig): WeddingCoverFrameOpen {
  return readCoverFrameOpen(config.coverFrameOpen) ?? 'bloom'
}

/** Chưa chọn: bung hoa lúc bấm mở. */
export function resolveOpenBurstEffect(config: WeddingSectionConfig): WeddingOpenBurstEffect {
  return readOpenBurstEffect(config.openBurstEffect) ?? 'bloom'
}

/** Chưa chọn: cánh hoa rơi lúc thiệp hiện lên. */
export function resolveOpenFallEffect(config: WeddingSectionConfig): WeddingOpenFallEffect {
  return readOpenFallEffect(config.openFallEffect) ?? 'petals'
}

/** Chưa chọn: rơi suốt lúc khách còn xem. */
export function resolveOpenFallSeconds(config: WeddingSectionConfig): number {
  return readOpenFallSeconds(config.openFallSeconds) ?? 0
}

export function openFallSecondsStopIndex(seconds: number): number {
  const index = WEDDING_OPEN_FALL_SECOND_STOPS.indexOf(seconds as (typeof WEDDING_OPEN_FALL_SECOND_STOPS)[number])
  return index >= 0 ? index : WEDDING_OPEN_FALL_SECOND_STOPS.length - 1
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
