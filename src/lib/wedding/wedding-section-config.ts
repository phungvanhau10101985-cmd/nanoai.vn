import { findWeddingBackgroundPreset } from '@/lib/wedding/wedding-background-presets'
import { WEDDING_STYLE_PRESETS } from '@/lib/wedding/wedding-style-presets'
import { isWeddingButtonColorId, type WeddingButtonColorId } from '@/lib/wedding/wedding-button-colors'
import { findWeddingCoverPreset, weddingCoverPresetFollowsBackground } from '@/lib/wedding/wedding-cover-presets'
import type { WeddingSharedFrame } from '@/lib/wedding/wedding-shared-frame'

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
  /** Cỡ khung ảnh trên vỏ, 0.6–1.4. 1 = cỡ mặc định. */
  coverFrameScale?: number
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
  /** Cỡ khung ảnh chú rể, 0.6–1.4. 1 = cỡ mặc định. */
  groomPortraitFrameScale?: number
  bridePhotoPositionX?: number
  bridePhotoPositionY?: number
  bridePhotoScale?: number
  /** Cỡ khung ảnh cô dâu, 0.6–1.4. 1 = cỡ mặc định. */
  bridePortraitFrameScale?: number
  /** Khách tự chọn khung chú rể. Không có thì khung theo nền. */
  groomPortraitFrameChosen?: boolean
  /** Khách tự chọn khung cô dâu. Không có thì khung theo nền. */
  bridePortraitFrameChosen?: boolean
  /** Khách tự chọn khung vỏ. Không có thì khung theo nền. */
  coverFrameChosen?: boolean
  /** Khung trang trí quanh ảnh chân dung. preset = khung mẫu. library = khung AI đã lưu. none = khách bỏ khung. */
  groomPortraitShellMode?: 'preset' | 'library' | 'none'
  groomPortraitShellPresetId?: string
  groomPortraitShellUrl?: string
  groomPortraitShellHole?: WeddingCoverAiFrameHole
  groomPortraitShellPanel?: string
  bridePortraitShellMode?: 'preset' | 'library' | 'none'
  bridePortraitShellPresetId?: string
  bridePortraitShellUrl?: string
  bridePortraitShellHole?: WeddingCoverAiFrameHole
  bridePortraitShellPanel?: string
  /** Màu nút Mở thiệp, gửi phản hồi, nhắc lịch và bản đồ. */
  buttonColorId?: WeddingButtonColorId
  /** Màu nút Có đi trên vỏ thiệp và trong thiệp. Không theo màu nút Mở thiệp. */
  coverRsvpColorId?: WeddingButtonColorId
  /** Một khung là kiểu cũ. Hai khung chồng chỉ ghi khi khách chọn. */
  heroPhotoLayout?: WeddingHeroPhotoLayout
  /** Vị trí khung và tên trên bố cục hai khung, phần trăm sân khấu. Có đủ tám số thì mới dùng. */
  stackGroomFrameX?: number
  stackGroomFrameY?: number
  stackBrideFrameX?: number
  stackBrideFrameY?: number
  stackGroomNameX?: number
  stackGroomNameY?: number
  stackBrideNameX?: number
  stackBrideNameY?: number
  /** Góc quay khung chú rể, độ. Trống thì −6. */
  stackGroomFrameRotate?: number
  /** Góc quay khung cô dâu, độ. Trống thì 3. */
  stackBrideFrameRotate?: number
  /** Vỏ hai khung theo máy. Có đủ vị trí của máy đó thì dùng, không thì dùng vị trí chung. */
  deviceShell?: {
    desktop?: WeddingDeviceShell
    mobile?: WeddingDeviceShell
  }
  /** Nền có sẵn. Một mẫu là một ảnh hoặc một bộ ảnh. Có mã này thì nền thiệp không dùng ảnh master. */
  backgroundPresetId?: string
  /** Phong cách của ảnh AI đang làm nền. Ảnh vẫn là tấm nền; khung, hoa, màu nút và chữ lấy theo bộ của phong cách này. */
  backgroundKitStyleId?: string
  /** Cỡ, kiểu và màu từng chỗ chữ trên thiệp. */
  textStyles?: Partial<Record<WeddingTextRole, WeddingTextStyle>>
}

export const WEDDING_TEXT_ROLES = ['groomName', 'brideName', 'intro', 'story', 'thanks', 'event'] as const
export type WeddingTextRole = (typeof WEDDING_TEXT_ROLES)[number]
export const WEDDING_TEXT_FONTS = ['script', 'soft', 'formal', 'lotus'] as const
export type WeddingTextFont = (typeof WEDDING_TEXT_FONTS)[number]
export type WeddingTextStyle = {
  /** Cỡ chữ, pixel. */
  size?: number
  font?: WeddingTextFont
  /** #rrggbb */
  color?: string
}

export type WeddingHeroPhotoLayout = 'single' | 'stack'

export function readHeroPhotoLayout(value: unknown): WeddingHeroPhotoLayout {
  return value === 'stack' ? 'stack' : 'single'
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

/** Khung ảnh to nhỏ quanh cỡ mặc định. Ảnh bên trong vẫn zoom riêng. */
export const WEDDING_FRAME_SCALE_MIN = 0.6
export const WEDDING_FRAME_SCALE_MAX = 1.8

export function clampWeddingFrameScale(value: number): number {
  return Math.max(WEDDING_FRAME_SCALE_MIN, Math.min(WEDDING_FRAME_SCALE_MAX, Math.round(value * 100) / 100))
}

function readFrameScale(value: unknown): number | undefined {
  const num = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isFinite(num)) return undefined
  return clampWeddingFrameScale(num)
}

function writeFrameScale(payload: WeddingSectionConfig, key: 'coverFrameScale' | 'groomPortraitFrameScale' | 'bridePortraitFrameScale', value: number | undefined) {
  const scale = readFrameScale(value)
  if (scale === undefined || scale === 1) return
  payload[key] = scale
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

const STACK_PLACE_KEYS = [
  'stackGroomFrameX',
  'stackGroomFrameY',
  'stackBrideFrameX',
  'stackBrideFrameY',
  'stackGroomNameX',
  'stackGroomNameY',
  'stackBrideNameX',
  'stackBrideNameY',
] as const

export type WeddingStackPlace = Record<(typeof STACK_PLACE_KEYS)[number], number>

export type WeddingDeviceShell = Partial<WeddingStackPlace> & {
  groomRotate?: number
  brideRotate?: number
  frameScale?: number
}

function readPlacePercent(value: unknown): number | undefined {
  const num = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isFinite(num)) return undefined
  return Math.max(-20, Math.min(100, Math.round(num * 10) / 10))
}

function readStackPlaceFields(obj: object): Partial<WeddingStackPlace> {
  const row = obj as Record<string, unknown>
  const place: Partial<WeddingStackPlace> = {}
  for (const key of STACK_PLACE_KEYS) {
    const value = readPlacePercent(row[key])
    if (value === undefined) return {}
    place[key] = value
  }
  return place
}

function writeStackPlace(payload: WeddingSectionConfig, config: WeddingSectionConfig) {
  const place = readStackPlaceFields(config)
  if (Object.keys(place).length !== STACK_PLACE_KEYS.length) return
  Object.assign(payload, place)
}

export function resolveStackPlace(config: WeddingSectionConfig): WeddingStackPlace | null {
  const place = readStackPlaceFields(config)
  if (Object.keys(place).length !== STACK_PLACE_KEYS.length) return null
  return place as WeddingStackPlace
}

export const STACK_FRAME_ROTATE_MIN = -40
export const STACK_FRAME_ROTATE_MAX = 40
export const STACK_GROOM_FRAME_ROTATE = -6
export const STACK_BRIDE_FRAME_ROTATE = 3

export function readStackFrameRotate(value: unknown): number | undefined {
  const num = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isFinite(num)) return undefined
  return Math.max(STACK_FRAME_ROTATE_MIN, Math.min(STACK_FRAME_ROTATE_MAX, Math.round(num)))
}

export function resolveStackFrameRotate(config: WeddingSectionConfig, side: 'groom' | 'bride'): number {
  const raw = side === 'groom' ? config.stackGroomFrameRotate : config.stackBrideFrameRotate
  return readStackFrameRotate(raw) ?? (side === 'groom' ? STACK_GROOM_FRAME_ROTATE : STACK_BRIDE_FRAME_ROTATE)
}

function readDeviceShellEntry(value: unknown): WeddingDeviceShell | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const row = value as Record<string, unknown>
  const place = readStackPlaceFields(row)
  const groomRotate = readStackFrameRotate(row.groomRotate)
  const brideRotate = readStackFrameRotate(row.brideRotate)
  const frameScale = readFrameScale(row.frameScale)
  const entry: WeddingDeviceShell = { ...place }
  if (groomRotate !== undefined) entry.groomRotate = groomRotate
  if (brideRotate !== undefined) entry.brideRotate = brideRotate
  if (frameScale !== undefined) entry.frameScale = frameScale
  if (!Object.keys(entry).length) return undefined
  return entry
}

export function parseWeddingDeviceShell(value: unknown): WeddingDeviceShell | null {
  return readDeviceShellEntry(value) ?? null
}

function readDeviceShell(value: unknown): WeddingSectionConfig['deviceShell'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const row = value as Record<string, unknown>
  const desktop = readDeviceShellEntry(row.desktop)
  const mobile = readDeviceShellEntry(row.mobile)
  if (!desktop && !mobile) return undefined
  return { ...(desktop ? { desktop } : {}), ...(mobile ? { mobile } : {}) }
}

function devicePlace(entry: WeddingDeviceShell | undefined): WeddingStackPlace | null {
  if (!entry) return null
  const place = readStackPlaceFields(entry)
  if (Object.keys(place).length !== STACK_PLACE_KEYS.length) return null
  return place as WeddingStackPlace
}

export function resolveDeviceStackPlace(
  config: WeddingSectionConfig,
  device: 'desktop' | 'mobile',
  shared?: WeddingDeviceShell | null,
): WeddingStackPlace | null {
  const own = devicePlace(config.deviceShell?.[device])
  if (own) return own
  if (device === 'desktop') {
    const card = resolveStackPlace(config)
    if (card) return card
  }
  const fromShared = devicePlace(shared ?? undefined)
  if (fromShared) return fromShared
  return device === 'mobile' ? resolveStackPlace(config) : null
}

export function resolveDeviceStackRotate(
  config: WeddingSectionConfig,
  device: 'desktop' | 'mobile',
  side: 'groom' | 'bride',
  shared?: WeddingDeviceShell | null,
): number {
  const own = side === 'groom' ? config.deviceShell?.[device]?.groomRotate : config.deviceShell?.[device]?.brideRotate
  if (own !== undefined) return own
  const cardRaw = side === 'groom' ? config.stackGroomFrameRotate : config.stackBrideFrameRotate
  const cardRotate = readStackFrameRotate(cardRaw)
  if (cardRotate !== undefined) return cardRotate
  const sharedRotate = side === 'groom' ? shared?.groomRotate : shared?.brideRotate
  if (sharedRotate !== undefined) return sharedRotate
  return side === 'groom' ? STACK_GROOM_FRAME_ROTATE : STACK_BRIDE_FRAME_ROTATE
}

export function resolveDeviceFrameScale(
  config: WeddingSectionConfig,
  device: 'desktop' | 'mobile',
  shared?: WeddingDeviceShell | null,
): number {
  const own = config.deviceShell?.[device]?.frameScale
  if (own !== undefined) return own
  const cardScale = readFrameScale(config.groomPortraitFrameScale)
  if (cardScale !== undefined) return cardScale
  if (shared?.frameScale !== undefined) return shared.frameScale
  return 1
}

/** Bỏ vỏ riêng của thiệp để thiệp này dùng mẫu chung. Máy desktop còn xóa vị trí chung đã chép từ vỏ. */
export function forgetPrivateDeviceShell(
  config: WeddingSectionConfig,
  device: 'desktop' | 'mobile',
): WeddingSectionConfig {
  const next: WeddingSectionConfig = {
    ...config,
    deviceShell: { ...config.deviceShell },
  }
  delete next.deviceShell?.[device]
  if (!next.deviceShell?.desktop && !next.deviceShell?.mobile) delete next.deviceShell
  if (device === 'desktop') {
    for (const key of STACK_PLACE_KEYS) delete next[key]
    delete next.stackGroomFrameRotate
    delete next.stackBrideFrameRotate
    delete next.groomPortraitFrameScale
    delete next.bridePortraitFrameScale
  }
  return next
}

/** Bỏ vỏ riêng khi quản trị đang sửa mẫu, để màn hình hiện đúng mẫu chung. */
export function withoutPrivateShell(config: WeddingSectionConfig): WeddingSectionConfig {
  return forgetPrivateDeviceShell(forgetPrivateDeviceShell(config, 'desktop'), 'mobile')
}

export function withDeviceShell(
  config: WeddingSectionConfig,
  device: 'desktop' | 'mobile',
  patch: WeddingDeviceShell,
): WeddingSectionConfig {
  const next: WeddingSectionConfig = {
    ...config,
    deviceShell: {
      ...config.deviceShell,
      [device]: { ...config.deviceShell?.[device], ...patch },
    },
  }
  if (device !== 'desktop') return next
  const place = devicePlace(next.deviceShell?.desktop)
  if (place) Object.assign(next, place)
  if (patch.groomRotate !== undefined) next.stackGroomFrameRotate = patch.groomRotate
  if (patch.brideRotate !== undefined) next.stackBrideFrameRotate = patch.brideRotate
  if (patch.frameScale !== undefined) {
    next.groomPortraitFrameScale = patch.frameScale
    next.bridePortraitFrameScale = patch.frameScale
  }
  return next
}

function writeStackRotate(payload: WeddingSectionConfig, config: WeddingSectionConfig) {
  const groom = readStackFrameRotate(config.stackGroomFrameRotate)
  const bride = readStackFrameRotate(config.stackBrideFrameRotate)
  if (groom !== undefined && groom !== STACK_GROOM_FRAME_ROTATE) payload.stackGroomFrameRotate = groom
  if (bride !== undefined && bride !== STACK_BRIDE_FRAME_ROTATE) payload.stackBrideFrameRotate = bride
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
      coverFrameScale: readFrameScale(obj.coverFrameScale),
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
      groomPortraitFrameScale: readFrameScale(obj.groomPortraitFrameScale),
      bridePhotoPositionX: readPercent(obj.bridePhotoPositionX),
      bridePhotoPositionY: readPercent(obj.bridePhotoPositionY),
      bridePhotoScale: readScale(obj.bridePhotoScale),
      bridePortraitFrameScale: readFrameScale(obj.bridePortraitFrameScale),
      ...readPortraitShell(obj, 'groom'),
      ...readPortraitShell(obj, 'bride'),
      groomPortraitFrameChosen: obj.groomPortraitFrameChosen === true ? true : undefined,
      bridePortraitFrameChosen: obj.bridePortraitFrameChosen === true ? true : undefined,
      coverFrameChosen: obj.coverFrameChosen === true ? true : undefined,
      buttonColorId: isWeddingButtonColorId(obj.buttonColorId) ? obj.buttonColorId : undefined,
      coverRsvpColorId: isWeddingButtonColorId(obj.coverRsvpColorId) ? obj.coverRsvpColorId : undefined,
      heroPhotoLayout: obj.heroPhotoLayout === 'stack' ? 'stack' : undefined,
      ...readStackPlaceFields(obj),
      stackGroomFrameRotate: readStackFrameRotate(obj.stackGroomFrameRotate),
      stackBrideFrameRotate: readStackFrameRotate(obj.stackBrideFrameRotate),
      deviceShell: readDeviceShell(obj.deviceShell),
      backgroundPresetId: readBackgroundPresetId(obj.backgroundPresetId),
      backgroundKitStyleId: readBackgroundKitStyleId(obj.backgroundKitStyleId),
      textStyles: readTextStyles(obj.textStyles),
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
  writeFrameScale(payload, 'coverFrameScale', config.coverFrameScale)
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
  writeFrameScale(payload, 'groomPortraitFrameScale', config.groomPortraitFrameScale)
  writeFrameScale(payload, 'bridePortraitFrameScale', config.bridePortraitFrameScale)
  writePortraitShell(payload, 'groom', config)
  writePortraitShell(payload, 'bride', config)
  if (config.groomPortraitFrameChosen) payload.groomPortraitFrameChosen = true
  if (config.bridePortraitFrameChosen) payload.bridePortraitFrameChosen = true
  if (config.coverFrameChosen) payload.coverFrameChosen = true
  if (isWeddingButtonColorId(config.buttonColorId)) payload.buttonColorId = config.buttonColorId
  if (isWeddingButtonColorId(config.coverRsvpColorId)) payload.coverRsvpColorId = config.coverRsvpColorId
  if (config.heroPhotoLayout === 'stack') payload.heroPhotoLayout = 'stack'
  writeStackPlace(payload, config)
  writeStackRotate(payload, config)
  if (config.deviceShell?.desktop || config.deviceShell?.mobile) payload.deviceShell = config.deviceShell
  const backgroundPresetId = readBackgroundPresetId(config.backgroundPresetId)
  if (backgroundPresetId) payload.backgroundPresetId = backgroundPresetId
  const backgroundKitStyleId = readBackgroundKitStyleId(config.backgroundKitStyleId)
  if (backgroundKitStyleId && !backgroundPresetId) payload.backgroundKitStyleId = backgroundKitStyleId
  const textStyles = readTextStyles(config.textStyles)
  if (textStyles) payload.textStyles = textStyles
  return JSON.stringify(payload)
}

const TEXT_COLOR = /^#[0-9a-fA-F]{6}$/

function readTextStyle(value: unknown): WeddingTextStyle | undefined {
  if (!value || typeof value !== 'object') return undefined
  const raw = value as Record<string, unknown>
  const style: WeddingTextStyle = {}
  const size = Number(raw.size)
  if (Number.isFinite(size)) style.size = Math.max(14, Math.min(72, Math.round(size)))
  if (WEDDING_TEXT_FONTS.includes(raw.font as WeddingTextFont)) style.font = raw.font as WeddingTextFont
  if (typeof raw.color === 'string' && TEXT_COLOR.test(raw.color)) style.color = raw.color.toLowerCase()
  if (style.size == null && !style.font && !style.color) return undefined
  return style
}

export function readTextStyles(value: unknown): WeddingSectionConfig['textStyles'] {
  if (!value || typeof value !== 'object') return undefined
  const raw = value as Record<string, unknown>
  const next: NonNullable<WeddingSectionConfig['textStyles']> = {}
  for (const role of WEDDING_TEXT_ROLES) {
    const style = readTextStyle(raw[role])
    if (style) next[role] = style
  }
  return Object.keys(next).length > 0 ? next : undefined
}

function readBackgroundPresetId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const id = value.trim()
  if (!id) return undefined
  return findWeddingBackgroundPreset(id)?.id
}

function readBackgroundKitStyleId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const id = value.trim()
  if (!id) return undefined
  return WEDDING_STYLE_PRESETS.some((preset) => preset.id === id) ? id : undefined
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

/** Cỡ khung vỏ. Chưa chỉnh thì 1. */
export function resolveCoverFrameScale(config: WeddingSectionConfig): number {
  return readFrameScale(config.coverFrameScale) ?? 1
}

/** Cỡ khung chân dung. Chưa chỉnh thì 1. */
export function resolvePortraitFrameScale(config: WeddingSectionConfig, side: 'groom' | 'bride'): number {
  return readFrameScale(side === 'groom' ? config.groomPortraitFrameScale : config.bridePortraitFrameScale) ?? 1
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

function readPortraitShellMode(value: unknown): 'preset' | 'library' | 'none' | undefined {
  return value === 'preset' || value === 'library' || value === 'none' ? value : undefined
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
  if (mode === 'none') return { [modeKey]: 'none' }
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
    return
  }
  if (mode === 'none') payload[modeKey] = 'none'
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

/** Khung ảnh khóa theo nền. Lựa chọn riêng và khung kho không gắn nền không được hiện. */
export function resolveShownPortraitShell(
  config: WeddingSectionConfig,
  side: 'groom' | 'bride',
  kitPresetId?: string,
  _shared?: WeddingSharedFrame | null,
): WeddingPortraitShellFrame | null {
  const kitFrame = findWeddingCoverPreset(kitPresetId ?? '')?.frame
  if (kitFrame) return { src: kitFrame.src, hole: kitFrame.hole, panel: kitFrame.panel }
  const chosen = side === 'groom' ? config.groomPortraitFrameChosen : config.bridePortraitFrameChosen
  if (chosen) return null
  return resolvePortraitShell(config, side)
}

/** Khung vỏ khóa theo nền. Lựa chọn riêng và khung kho không gắn nền không được hiện. */
export function resolveShownCoverFrame(
  config: WeddingSectionConfig,
  kitPresetId?: string,
  _shared?: WeddingSharedFrame | null,
): {
  mode: WeddingCoverFrameMode
  presetId: string
  library?: { src: string; hole: WeddingCoverAiFrameHole; panel: string; ink: 'dark' | 'light' } | null
} {
  const kit = kitPresetId?.trim()
  if (kit && weddingCoverPresetFollowsBackground(findWeddingCoverPreset(kit))) {
    return { mode: 'preset', presetId: kit }
  }
  if (!config.coverFrameChosen) {
    const mode = resolveCoverFrameMode(config)
    if ((mode === 'library' || mode === 'ai')) {
      const own = resolveCoverAiFrame(config)
      if (own) return { mode, presetId: config.coverPresetId?.trim() || kit || '', library: own }
    }
    if (mode === 'preset' && weddingCoverPresetFollowsBackground(findWeddingCoverPreset(config.coverPresetId ?? ''))) {
      return { mode: 'preset', presetId: config.coverPresetId?.trim() || '' }
    }
  }
  return {
    mode: 'preset',
    presetId: kit || (!config.coverFrameChosen ? config.coverPresetId?.trim() : '') || '',
  }
}

/** Ghi lựa chọn khung lên đúng thiệp. Không đụng vị trí vỏ hay bộ nền gốc. */
export function applyWeddingFrameChoice(existingRaw: string | null | undefined, clientRaw: string | null | undefined): string {
  const existing = parseWeddingSectionConfig(existingRaw)
  const client = parseWeddingSectionConfig(clientRaw)
  const next: WeddingSectionConfig = { ...existing }
  for (const side of ['groom', 'bride'] as const) {
    const chosenKey = side === 'groom' ? 'groomPortraitFrameChosen' : 'bridePortraitFrameChosen'
    for (const key of portraitShellKeys(side)) delete next[key]
    delete next[chosenKey]
    if (!client[chosenKey]) continue
    next[chosenKey] = true
    const shell = readPortraitShell(client as unknown as Record<string, unknown>, side)
    Object.assign(next, shell)
  }
  delete next.coverFrameChosen
  if (client.coverFrameChosen) {
    next.coverFrameChosen = true
    next.coverFrameMode = client.coverFrameMode
    next.coverPresetId = client.coverPresetId
    next.coverAiFrameUrl = client.coverAiFrameUrl
    next.coverAiFrameHole = client.coverAiFrameHole
    next.coverAiFramePanel = client.coverAiFramePanel
    next.coverAiFrameInk = client.coverAiFrameInk
  }
  return stringifyWeddingSectionConfig(next)
}

/** Bỏ lựa chọn riêng của một vị trí để vị trí đó theo khung mặc định của nền. */
export function clearWeddingFrameChoice(raw: string | null | undefined, side: 'cover' | 'groom' | 'bride' | 'pair'): string {
  const next = parseWeddingSectionConfig(raw)
  const clearPortrait = (who: 'groom' | 'bride') => {
    const chosenKey = who === 'groom' ? 'groomPortraitFrameChosen' : 'bridePortraitFrameChosen'
    delete next[chosenKey]
    for (const key of portraitShellKeys(who)) delete next[key]
  }
  if (side === 'cover') {
    delete next.coverFrameChosen
    delete next.coverFrameMode
  }
  if (side === 'groom' || side === 'pair') clearPortrait('groom')
  if (side === 'bride' || side === 'pair') clearPortrait('bride')
  return stringifyWeddingSectionConfig(next)
}

export function mergeWeddingSectionConfig(
  raw: string | null | undefined,
  patch: Partial<WeddingSectionConfig>,
): string {
  const current = parseWeddingSectionConfig(raw)
  return stringifyWeddingSectionConfig({ ...current, ...patch })
}

/** Bản client là đủ cho khung chân dung. Thiếu mode nghĩa là gỡ khung, không giữ khung cũ trên server. */
export function applyClientWeddingSectionConfig(
  existingRaw: string | null | undefined,
  clientRaw: string | null | undefined,
): string {
  const existing = parseWeddingSectionConfig(existingRaw)
  const next = parseWeddingSectionConfig(clientRaw)
  let raw: Record<string, unknown> = {}
  try {
    const value = JSON.parse(clientRaw || '{}') as unknown
    if (value && typeof value === 'object' && !Array.isArray(value)) raw = value as Record<string, unknown>
  } catch {
    raw = {}
  }
  const base: WeddingSectionConfig = { ...existing }
  for (const side of ['groom', 'bride'] as const) {
    const modeKey = side === 'groom' ? 'groomPortraitShellMode' : 'bridePortraitShellMode'
    const chosenKey = side === 'groom' ? 'groomPortraitFrameChosen' : 'bridePortraitFrameChosen'
    const mode = raw[modeKey]
    if (raw[chosenKey] !== true) delete base[chosenKey]
    if (mode !== 'library' && mode !== 'preset' && mode !== 'none') {
      for (const key of portraitShellKeys(side)) delete base[key]
    }
  }
  if (raw.coverFrameChosen !== true) delete base.coverFrameChosen
  return stringifyWeddingSectionConfig({ ...base, ...next })
}

export function resolveCoverPhotoUrl(config: WeddingSectionConfig): string {
  return config.coverPhotoUrl?.trim() || ''
}

/** Ảnh nền của thiệp không được đứng vào ô ảnh khách tải lên. */
export function coverPhotoUrlUnlessBackground(
  photoUrl: string | null | undefined,
  backgroundUrl: string | null | undefined,
): string {
  const photo = photoUrl?.trim() || ''
  const background = backgroundUrl?.trim() || ''
  if (!photo || (background && photo === background)) return ''
  return photo
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
  position: 'absolute'
  width: string
  height: string
  left: string
  top: string
  right: string
  bottom: string
  maxWidth: string
  transform: string
} {
  const x = readPercent(frame.x) ?? 50
  const y = readPercent(frame.y) ?? 0
  const scale = readScale(frame.scale) ?? 1
  // Phóng bằng kích thước ảnh, không scale lần hai, để ảnh album không bị mờ.
  return {
    objectPosition: `${x}% ${y}%`,
    position: 'absolute',
    width: `${scale * 100}%`,
    height: `${scale * 100}%`,
    left: `${x * (1 - scale)}%`,
    top: `${y * (1 - scale)}%`,
    right: 'auto',
    bottom: 'auto',
    maxWidth: 'none',
    transform: 'none',
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
