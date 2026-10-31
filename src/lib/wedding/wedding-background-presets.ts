import type { CSSProperties } from 'react'
import type { WebLocale } from '@/lib/i18n/config'
import type { WeddingButtonColorId } from '@/lib/wedding/wedding-button-colors'
import { findWeddingCoverPreset, weddingCoverPresetFollowsBackground } from '@/lib/wedding/wedding-cover-presets'
import type { WeddingTheme } from '@/lib/wedding/wedding-theme'
import {
  WEDDING_DESKTOP_HEIGHT,
  WEDDING_DESKTOP_MIN_PX,
  WEDDING_DESKTOP_WIDTH,
  WEDDING_MOBILE_HEIGHT,
  WEDDING_MOBILE_WIDTH,
} from '@/lib/wedding/wedding-design-viewport'

/** Cành hoa và tiểu tiết nổi trên ảnh cô dâu chú rể, tên và thông tin. */
export type WeddingBackgroundOrnament = {
  src: string
  /** Mé trái, phần trăm bề ngang trang. */
  x: number
  /** Mé trên, hoặc mé đáy khi anchor là bottom. Phần trăm bề cao trang. */
  y: number
  /** Bề ngang, phần trăm bề ngang trang. */
  w: number
  rotate?: number
  flipX?: boolean
  opacity?: number
  /** Độ mờ, pixel. 0 là nét. */
  blur?: number
  /** 0 là đủ màu, 1 là mất màu. */
  fade?: number
  /** Không ghi thì đứng yên. `rise` trượt lên một đoạn khi lướt tới. */
  motion?: 'rise'
  anchor?: 'top' | 'bottom'
}

export function weddingOrnamentBlurPx(value: number | undefined) {
  const blur = Number(value)
  if (!Number.isFinite(blur) || blur <= 0) return 0
  return Math.min(12, Math.round(blur))
}

export function weddingOrnamentFadeAmount(value: number | undefined) {
  const fade = Number(value)
  if (!Number.isFinite(fade) || fade <= 0) return 0
  return Math.min(1, Math.round(fade * 100) / 100)
}

export function weddingOrnamentRises(item: { motion?: string | null }) {
  return item.motion === 'rise'
}

/** Làm mờ và làm nhạt màu của một ảnh thêm vào. */
export function weddingOrnamentFilter(item: Pick<WeddingBackgroundOrnament, 'blur' | 'fade'>) {
  const blur = weddingOrnamentBlurPx(item.blur)
  const fade = weddingOrnamentFadeAmount(item.fade)
  const parts: string[] = []
  if (blur > 0) parts.push(`blur(${blur}px)`)
  if (fade > 0) parts.push(`saturate(${Math.round((1 - fade) * 100) / 100})`)
  return parts.join(' ') || undefined
}

/** Một khổ vài hoa, nội dung lặp tới 12 khổ. */
export const WEDDING_ORNAMENT_LIST_MAX = 120

/** Số khổ giấy hoa văn cần phủ. Hơi dài hơn một khổ thì vẫn một khổ, kẻo hoa bị nhân đôi. */
export function weddingOrnamentPageCount(frameWidth: number, frameHeight: number) {
  const desktop = frameWidth >= WEDDING_DESKTOP_MIN_PX
  const page = frameWidth * ((desktop ? WEDDING_DESKTOP_HEIGHT : WEDDING_MOBILE_HEIGHT) / (desktop ? WEDDING_DESKTOP_WIDTH : WEDDING_MOBILE_WIDTH))
  if (!(page > 0) || !(frameHeight > 0)) return 1
  const raw = frameHeight / page
  if (raw <= 1.25) return 1
  return Math.min(12, Math.ceil(raw - 0.15))
}

export type WeddingOrnamentPlacement = WeddingBackgroundOrnament & {
  seed: number
  page: number
}

/** Hoa còn nằm trong một khổ. Hoa đã trải xuống nội dung thì không lặp thêm. */
export function weddingOrnamentsAreOneSheet(items: readonly WeddingBackgroundOrnament[]) {
  const tops = items.filter((item) => item.anchor !== 'bottom')
  if (tops.length === 0) return true
  return tops.every((item) => item.y <= 36)
}

function clampOrnament(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.round(Math.min(max, Math.max(min, value)) * 10) / 10
}

export function weddingOrnamentPlain(item: WeddingBackgroundOrnament & { seed?: number; page?: number }): WeddingBackgroundOrnament {
  const { seed, page, ...rest } = item
  void seed
  void page
  const plain: WeddingBackgroundOrnament = {
    ...rest,
    x: clampOrnament(rest.x, -40, 110),
    y: clampOrnament(rest.y, -40, 110),
    w: clampOrnament(rest.w, 8, 90),
  }
  if (plain.opacity != null) plain.opacity = clampOrnament(plain.opacity, 0.15, 1)
  return plain
}

/** Bước phần trăm từ pixel. Bước nhỏ hơn một số lưu thì vẫn nhích 0.1 để phím mũi tên không đứng im. */
function ornamentPercentDelta(px: number, span: number) {
  if (px === 0 || !(span > 0)) return 0
  const stepped = Math.round((px / span) * 1000) / 10
  if (stepped !== 0) return stepped
  return Math.sign(px) * 0.1
}

/** Dời hoa theo pixel trên màn hình. Hoa neo đáy thì trục dọc đi ngược. */
export function nudgeWeddingOrnament(
  item: WeddingBackgroundOrnament,
  dxPx: number,
  dyPx: number,
  frameWidth: number,
  frameHeight: number,
): WeddingBackgroundOrnament {
  const bottom = item.anchor === 'bottom'
  return weddingOrnamentPlain({
    ...item,
    x: item.x + ornamentPercentDelta(dxPx, frameWidth),
    y: item.y + ornamentPercentDelta(bottom ? -dyPx : dyPx, frameHeight),
  })
}

/**
 * Một khổ giữ đúng chỗ đã đặt. Nội dung dài hơn thì lặp cùng hoa xuống từng khổ,
 * thu nhỏ và đẩy sát mép để giữa trang còn chỗ cho chữ.
 */
export function repeatWeddingOrnamentsDown(items: readonly WeddingBackgroundOrnament[], pages: number): WeddingOrnamentPlacement[] {
  let count = Math.max(1, Math.min(12, Math.round(pages) || 1))
  while (count > 1 && count * items.length > WEDDING_ORNAMENT_LIST_MAX) count -= 1
  if (count <= 1) return items.map((item, seed) => ({ ...item, seed, page: 0 }))
  const span = 100 / count
  const placed: WeddingOrnamentPlacement[] = []
  for (let page = 0; page < count; page++) {
    items.forEach((item, seed) => {
      const local = item.anchor === 'bottom' ? 100 - item.y : item.y
      const y = Math.round((page * span + (local / 100) * span) * 10) / 10
      if (page === 0) {
        placed.push({ ...item, anchor: 'top', y, seed, page })
        return
      }
      const sideLeft = item.x + item.w / 2 < 50
      const drift = page % 2 === 0 ? 0 : Math.round(span * 0.06 * 10) / 10
      const w = Math.min(item.w, 18)
      placed.push({
        ...item,
        anchor: 'top',
        x: sideLeft ? Math.min(item.x, Math.round((12 - w) * 10) / 10) : Math.max(item.x, 88),
        y: Math.round((y + drift) * 10) / 10,
        w,
        opacity: Math.min(item.opacity ?? 1, 0.82),
        seed,
        page,
      })
    })
  }
  return placed
}

export type WeddingOrnamentBox = {
  top: number
  left: number
  width: number
  height: number
}

/**
 * Chỗ thả hoa mới: mé trên của phần khung đang nằm trong màn hình.
 * Không thấy khung thì trả về mé trên khổ, để người xem còn thấy hoa.
 */
export function weddingOrnamentSpotInView(input: {
  frame: WeddingOrnamentBox
  view: WeddingOrnamentBox
  width?: number
}): { x: number; y: number; w: number } {
  const w = input.width ?? 28
  const frame = input.frame
  const view = input.view
  const fallback = { x: 8, y: 8, w }
  if (frame.width < 1 || frame.height < 1 || view.width < 1 || view.height < 1) return fallback
  const top = Math.max(frame.top, view.top)
  const left = Math.max(frame.left, view.left)
  const bottom = Math.min(frame.top + frame.height, view.top + view.height)
  const right = Math.min(frame.left + frame.width, view.left + view.width)
  if (bottom - top < 1 || right - left < 1) return fallback
  const rawX = ((left + (right - left) / 2 - frame.left) / frame.width) * 100 - w / 2
  const rawY = ((top - frame.top) / frame.height) * 100 + 6
  return {
    x: Math.round(Math.min(100 - w, Math.max(0, rawX)) * 10) / 10,
    y: Math.round(Math.min(92, Math.max(0, rawY)) * 10) / 10,
    w,
  }
}

/** Phần iframe đang lọt vào cửa sổ cha, đổi về pixel bố cục của iframe. */
export function weddingIframeVisibleView(input: {
  frameTop: number
  frameLeft: number
  frameWidth: number
  frameHeight: number
  layoutWidth: number
  layoutHeight: number
  viewportWidth: number
  viewportHeight: number
}): { x: number; y: number; w: number; h: number } | null {
  const { frameTop, frameLeft, frameWidth, frameHeight, layoutWidth, layoutHeight, viewportWidth, viewportHeight } = input
  if (frameWidth < 1 || layoutWidth < 1 || layoutHeight < 1) return null
  const scale = frameWidth / layoutWidth
  if (!(scale > 0)) return null
  const visLeft = Math.max(frameLeft, 0)
  const visTop = Math.max(frameTop, 0)
  const visRight = Math.min(frameLeft + frameWidth, viewportWidth)
  const visBottom = Math.min(frameTop + frameHeight, viewportHeight)
  if (visRight - visLeft < 8 || visBottom - visTop < 8) return null
  return {
    x: Math.round(((visLeft - frameLeft) / scale) * 10) / 10,
    y: Math.round(((visTop - frameTop) / scale) * 10) / 10,
    w: Math.round(((visRight - visLeft) / scale) * 10) / 10,
    h: Math.round(((visBottom - visTop) / scale) * 10) / 10,
  }
}

/** Cùng một hộp cho bản sửa và bản khách. Phần trăm của khung thiệp, không của cửa sổ. */
export function weddingOrnamentFrameStyle(item: Pick<WeddingBackgroundOrnament, 'x' | 'y' | 'w' | 'anchor'>): CSSProperties {
  const bottom = item.anchor === 'bottom'
  return {
    left: `${item.x}%`,
    top: bottom ? 'auto' : `${item.y}%`,
    bottom: bottom ? `${item.y}%` : 'auto',
    width: `${item.w}%`,
  }
}

export function weddingOrnamentImageStyle(item: Pick<WeddingBackgroundOrnament, 'rotate' | 'flipX' | 'opacity' | 'blur' | 'fade'>): CSSProperties {
  return {
    opacity: item.opacity ?? 1,
    filter: weddingOrnamentFilter(item),
    transform: `rotate(${item.rotate ?? 0}deg) scaleX(${item.flipX ? -1 : 1})`,
  }
}

/** Màu nút, màu chữ, nền chữ và kiểu chữ đi cùng một bộ nền. */
export type WeddingKitLook = {
  styleId: string
  buttonColorId: WeddingButtonColorId
  coverRsvpColorId: WeddingButtonColorId
  ink: string
  muted: string
  accent: string
  textClass: string
  mutedClass: string
  accentClass: string
  accentTextClass: string
  textPlate: string
  fontClass: 'wedding-font-soft' | 'wedding-font-formal' | 'wedding-font-lotus'
  shareFont: string
  /** Giấy tối: chữ sáng, không phủ lớp kem lên hoa văn. */
  surface?: 'dark'
  paper?: string
  /** Tấm kem trên giấy đỏ. Chữ trong tấm dùng ink. */
  contentCard?: 'scallop'
}

const LEAF = '/wedding/backgrounds/ornaments/garden-leaves.png'
const DO_SON_CORNER = '/wedding/backgrounds/ornaments/do-son-corner.svg'
const LOTUS = '/wedding/backgrounds/ornaments/lotus-bloom.png'
const DRIED_SPRIG = '/wedding/backgrounds/ornaments/dried-sprig.png'
const MOC_BLOOM = '/wedding/backgrounds/ornaments/moc-bloom.png'
const MIST_SPRIG = '/wedding/backgrounds/ornaments/mist-sprig.png'
const DO_DAM_PEONY = '/wedding/backgrounds/ornaments/do-dam-peony.png'
const DO_DAM_STEM = '/wedding/backgrounds/ornaments/do-dam-stem.png'
const PEARL_ROSE = '/wedding/backgrounds/ornaments/pearl-rose.png'
const LONG_PHUNG_CLOUD = '/wedding/backgrounds/ornaments/long-phung-cloud.svg'
const SONG_HY_SEAL = '/wedding/backgrounds/ornaments/song-hy-seal.svg'
const PEARL_BUTTERFLY = '/wedding/backgrounds/ornaments/pearl-butterfly.png'
const PEARL_STRAND = '/wedding/backgrounds/ornaments/pearl-strand.png'

const SOFT_FONT = 'Palatino Linotype, Palatino, Georgia, serif'
const FORMAL_FONT = 'Georgia, Times New Roman, serif'

/** Hai điểm nhấn: một lá trên, một lá dưới. */
const GARDEN_ORNAMENTS: readonly WeddingBackgroundOrnament[] = [
  { src: LEAF, x: -8, y: 2, w: 16, rotate: -12, opacity: 0.72 },
  { src: LEAF, x: 92, y: 90, w: 14, rotate: 14, flipX: true, opacity: 0.42 },
]

/** Mây vàng nét mảnh, cùng chất với rồng phượng trên nền. Chỉ bám góc. */
const LONG_PHUNG_ORNAMENTS: readonly WeddingBackgroundOrnament[] = [
  { src: LONG_PHUNG_CLOUD, x: -14, y: -4, w: 22, rotate: -8, opacity: 0.62 },
  { src: LONG_PHUNG_CLOUD, x: 90, y: -4, w: 16, rotate: -10, flipX: true, anchor: 'bottom', opacity: 0.42 },
]

/** Hồi văn góc vàng, cùng nét với hoa văn dệt trên nền đỏ son. Không cánh hoa. */
const SCARLET_ORNAMENTS: readonly WeddingBackgroundOrnament[] = [
  { src: DO_SON_CORNER, x: -4, y: 0, w: 16, opacity: 0.96 },
  { src: DO_SON_CORNER, x: 88, y: 0, w: 12, rotate: 180, anchor: 'bottom', opacity: 0.92 },
]

const LOTUS_ORNAMENTS: readonly WeddingBackgroundOrnament[] = [
  { src: LOTUS, x: -16, y: -2, w: 24, opacity: 0.9 },
  { src: LOTUS, x: 88, y: -6, w: 18, opacity: 0.5, anchor: 'bottom' },
]

const PEARL_ORNAMENTS: readonly WeddingBackgroundOrnament[] = [
  { src: PEARL_ROSE, x: -16, y: -1, w: 24, opacity: 0.88 },
  { src: PEARL_STRAND, x: 88, y: -2, w: 16, rotate: 18, opacity: 0.65, anchor: 'bottom' },
]

const GARDEN_LOOK: WeddingKitLook = {
  styleId: 'floral',
  buttonColorId: 'rose',
  coverRsvpColorId: 'blush',
  ink: '#3a2a2e',
  muted: '#6b4a52',
  accent: '#9d4e63',
  textClass: 'text-[#3a2a2e]',
  mutedClass: 'text-[#6b4a52]',
  accentClass: 'text-[#9d4e63]',
  accentTextClass: 'text-[#7a3b4e]',
  textPlate: 'rgba(255,247,248,0.78)',
  fontClass: 'wedding-font-soft',
  shareFont: SOFT_FONT,
}

const GOLD_ON_RED_GLOW =
  '[text-shadow:0_0_1px_rgba(32,4,8,0.96),0_1px_2px_rgba(32,4,8,0.94),0_2px_6px_rgba(32,4,8,0.72)]'
const GOLD_ON_RED_GLOW_HEADING =
  '[text-shadow:0_1px_2px_rgba(32,4,8,0.96),0_2px_8px_rgba(32,4,8,0.78)]'

const RED_LOOK: WeddingKitLook = {
  styleId: 'traditional_vietnamese',
  buttonColorId: 'cream',
  coverRsvpColorId: 'ivory',
  ink: '#f6e4b8',
  muted: '#e4d0a0',
  accent: '#f3d27a',
  textClass: 'text-[#f6e4b8]',
  mutedClass: 'text-[#e4d0a0]',
  accentClass: 'text-[#f3d27a]',
  accentTextClass: 'text-[#ffe7b0]',
  textPlate: 'rgba(62,10,18,0.78)',
  fontClass: 'wedding-font-formal',
  shareFont: FORMAL_FONT,
  surface: 'dark',
  paper: '#5c1018',
}

/** Dấu song hỷ vàng, bám góc. Hoa văn lớn nằm trên tấm giấy. */
const SONG_HY_ORNAMENTS: readonly WeddingBackgroundOrnament[] = [
  { src: SONG_HY_SEAL, x: -1, y: 1, w: 12, opacity: 0.72 },
  { src: SONG_HY_SEAL, x: 89, y: 0, w: 10, anchor: 'bottom', opacity: 0.42 },
]

const SONG_HY_LOOK: WeddingKitLook = {
  styleId: 'traditional_vietnamese',
  buttonColorId: 'cream',
  coverRsvpColorId: 'ivory',
  ink: '#7a1c28',
  muted: '#8d4a42',
  accent: '#9a1c2c',
  textClass: 'text-[#7a1c28]',
  mutedClass: 'text-[#8d4a42]',
  accentClass: 'text-[#9a1c2c]',
  accentTextClass: 'text-[#6e1824]',
  textPlate: 'rgba(255,246,234,0.94)',
  fontClass: 'wedding-font-formal',
  shareFont: FORMAL_FONT,
  paper: '#4e1018',
  contentCard: 'scallop',
}

const SCARLET_LOOK: WeddingKitLook = {
  styleId: 'traditional_vietnamese',
  buttonColorId: 'wine',
  coverRsvpColorId: 'gold',
  ink: '#fff8ee',
  muted: '#fff4e4',
  accent: '#ffe7b0',
  textClass: 'text-[#fff8ee]',
  mutedClass: 'text-[#fff4e4]',
  accentClass: 'text-[#ffe7b0]',
  accentTextClass: 'text-[#fff6d4]',
  textPlate: 'rgba(74,12,18,0.78)',
  fontClass: 'wedding-font-formal',
  shareFont: FORMAL_FONT,
  surface: 'dark',
  paper: '#6e1820',
}

const SKY_ORNAMENTS: readonly WeddingBackgroundOrnament[] = [
  { src: PEARL_BUTTERFLY, x: -10, y: 0, w: 18, rotate: -14, opacity: 0.9 },
  { src: PEARL_BUTTERFLY, x: 90, y: 1, w: 14, rotate: 16, flipX: true, anchor: 'bottom', opacity: 0.85 },
]

const SKY_LOOK: WeddingKitLook = {
  styleId: 'floral',
  buttonColorId: 'rose',
  coverRsvpColorId: 'blush',
  ink: '#2f3d4c',
  muted: '#5d6d7c',
  accent: '#b25b74',
  textClass: 'text-[#2f3d4c]',
  mutedClass: 'text-[#5d6d7c]',
  accentClass: 'text-[#b25b74]',
  accentTextClass: 'text-[#8d4560]',
  textPlate: 'rgba(255,248,252,0.8)',
  fontClass: 'wedding-font-soft',
  shareFont: SOFT_FONT,
}

const PEARL_LOOK: WeddingKitLook = {
  styleId: 'floral',
  buttonColorId: 'rose',
  coverRsvpColorId: 'blush',
  ink: '#4a2c38',
  muted: '#7a4e5c',
  accent: '#b05a78',
  textClass: 'text-[#4a2c38]',
  mutedClass: 'text-[#7a4e5c]',
  accentClass: 'text-[#b05a78]',
  accentTextClass: 'text-[#8d4560]',
  textPlate: 'rgba(255,248,250,0.8)',
  fontClass: 'wedding-font-soft',
  shareFont: SOFT_FONT,
}

const LINEN_ORNAMENTS: readonly WeddingBackgroundOrnament[] = [
  { src: DRIED_SPRIG, x: -14, y: -2, w: 22, rotate: -8, opacity: 0.9 },
  { src: DRIED_SPRIG, x: 88, y: -1, w: 16, rotate: 12, flipX: true, anchor: 'bottom', opacity: 0.82 },
]

/** Hoa và lá chụp thật, bám góc, để giữa trang trống cho chữ. */
const MOC_ORNAMENTS: readonly WeddingBackgroundOrnament[] = [
  { src: MOC_BLOOM, x: -16, y: -3, w: 22, rotate: -8, opacity: 0.92 },
  { src: MOC_BLOOM, x: 88, y: -6, w: 16, flipX: true, opacity: 0.55, anchor: 'bottom' },
]

/** Vài nhánh baby bám mép. Ảnh để trần, không khung. */
const CALLA_ORNAMENTS: readonly WeddingBackgroundOrnament[] = [
  { src: MIST_SPRIG, x: -8, y: 0, w: 12, rotate: -8, opacity: 0.7 },
  { src: MIST_SPRIG, x: 90, y: 0, w: 11, rotate: 6, anchor: 'bottom', opacity: 0.6 },
]

const CALLA_LOOK: WeddingKitLook = {
  styleId: 'minimal',
  buttonColorId: 'olive',
  coverRsvpColorId: 'olive',
  ink: '#3e4f34',
  muted: '#3e4f34',
  accent: '#5c6b40',
  textClass: 'text-[#3e4f34]',
  mutedClass: 'text-[#3e4f34]',
  accentClass: 'text-[#5c6b40]',
  accentTextClass: 'text-[#2f3d28]',
  textPlate: 'rgba(247,250,244,0.8)',
  fontClass: 'wedding-font-soft',
  shareFont: SOFT_FONT,
}

const MOC_LOOK: WeddingKitLook = {
  styleId: 'minimal',
  buttonColorId: 'forest',
  coverRsvpColorId: 'olive',
  ink: '#1f3d2b',
  muted: '#4d6b56',
  accent: '#3e5a44',
  textClass: 'text-[#1f3d2b]',
  mutedClass: 'text-[#4d6b56]',
  accentClass: 'text-[#3e5a44]',
  accentTextClass: 'text-[#2c4a36]',
  textPlate: 'rgba(255,252,246,0.78)',
  fontClass: 'wedding-font-soft',
  shareFont: SOFT_FONT,
}

const LINEN_LOOK: WeddingKitLook = {
  styleId: 'ethereal',
  buttonColorId: 'charcoal',
  coverRsvpColorId: 'champagne',
  ink: '#4a433c',
  muted: '#5a4e44',
  accent: '#8d7355',
  textClass: 'text-[#4a433c]',
  mutedClass: 'text-[#5a4e44]',
  accentClass: 'text-[#8d7355]',
  accentTextClass: 'text-[#6e5b45]',
  textPlate: 'rgba(247,242,234,0.72)',
  fontClass: 'wedding-font-soft',
  shareFont: SOFT_FONT,
}

/** Mẫu đơn đỏ rượu, hồng kem và baby rượu, bám hai mép từng khổ. Giữa trang để trống cho chữ. */
const DO_DAM_ORNAMENTS: readonly WeddingBackgroundOrnament[] = [
  { src: DO_DAM_PEONY, x: -16, y: -2, w: 22, rotate: -10, opacity: 0.94 },
  { src: DO_DAM_STEM, x: 94, y: 1, w: 14, rotate: 16, anchor: 'bottom', opacity: 0.75 },
]

const DO_DAM_LOOK: WeddingKitLook = {
  styleId: 'minimal',
  buttonColorId: 'burgundy',
  coverRsvpColorId: 'ivory',
  ink: '#4a1e2c',
  muted: '#7a5360',
  accent: '#6b2136',
  textClass: 'text-[#4a1e2c]',
  mutedClass: 'text-[#7a5360]',
  accentClass: 'text-[#6b2136]',
  accentTextClass: 'text-[#5c1a28]',
  textPlate: 'rgba(255,248,244,0.84)',
  fontClass: 'wedding-font-soft',
  shareFont: SOFT_FONT,
}

const LOTUS_LOOK: WeddingKitLook = {
  styleId: 'luxury',
  buttonColorId: 'gold',
  coverRsvpColorId: 'champagne',
  ink: '#3b2618',
  muted: '#5c4632',
  accent: '#8a5a12',
  textClass: 'text-[#3b2618]',
  mutedClass: 'text-[#5c4632]',
  accentClass: 'text-[#8a5a12]',
  accentTextClass: 'text-[#6b4310]',
  textPlate: 'rgba(255,248,230,0.82)',
  fontClass: 'wedding-font-lotus',
  shareFont: SOFT_FONT,
}

/**
 * Bộ nền có sẵn. Chọn một bộ là đổi nền, khung, hoa nổi, màu nút, màu chữ, nền chữ và kiểu chữ.
 * plates nằm dưới ảnh và chữ. ornaments là ảnh hoa nổi trên chữ.
 */
export type WeddingBackgroundPreset = {
  id: string
  plates: readonly string[]
  ornaments: readonly WeddingBackgroundOrnament[]
  /** Khung vỏ đi cùng bộ nền. */
  coverPresetId: string
  /** Bố cục ảnh đi cùng bộ nền. Không khai báo thì một khung. */
  heroPhotoLayout?: 'single' | 'stack'
  look: WeddingKitLook
  label: Record<WebLocale, string>
}

export const WEDDING_BACKGROUND_PRESETS: WeddingBackgroundPreset[] = [
  {
    id: 'toi-gian-nau',
    plates: ['/wedding/backgrounds/toi-gian-nau.jpg'],
    ornaments: LINEN_ORNAMENTS,
    coverPresetId: 'linen_polaroid',
    look: LINEN_LOOK,
    label: {
      vi: 'Tối giản nâu',
      en: 'Warm minimal',
      zh: '暖色极简',
      ja: 'あたたかいミニマル',
      ko: '따뜻한 미니멀',
    },
  },
  {
    id: 'vuon-kinh-hong',
    plates: ['/wedding/backgrounds/vuon-kinh-hong-wash.jpg'],
    ornaments: GARDEN_ORNAMENTS,
    coverPresetId: 'pearl_rose',
    look: GARDEN_LOOK,
    label: {
      vi: 'Vườn kính hồng',
      en: 'Pink glass garden',
      zh: '粉玻璃花园',
      ja: 'ピンクのガラスガーデン',
      ko: '핑크 글라스 가든',
    },
  },
  {
    id: 'long-phung-do',
    plates: ['/wedding/backgrounds/long-phung-do-1.jpg', '/wedding/backgrounds/long-phung-do-2.jpg'],
    ornaments: LONG_PHUNG_ORNAMENTS,
    coverPresetId: 'plain_photo',
    look: RED_LOOK,
    label: {
      vi: 'Long phụng đỏ',
      en: 'Red dragon and phoenix',
      zh: '龙凤正红',
      ja: '龍鳳・赤',
      ko: '용봉 빨강',
    },
  },
  {
    id: 'do-son',
    plates: ['/wedding/backgrounds/do-son.jpg'],
    ornaments: SCARLET_ORNAMENTS,
    coverPresetId: 'plain_photo',
    look: SCARLET_LOOK,
    label: {
      vi: 'Đỏ son',
      en: 'Scarlet',
      zh: '正红',
      ja: '朱色',
      ko: '진홍',
    },
  },
  {
    id: 'song-hy-do',
    plates: ['/wedding/backgrounds/song-hy-do.svg'],
    ornaments: SONG_HY_ORNAMENTS,
    coverPresetId: 'song_hy',
    look: SONG_HY_LOOK,
    label: {
      vi: 'Song hỷ đỏ',
      en: 'Double happiness red',
      zh: '双喜正红',
      ja: '双喜・赤',
      ko: '쌍희 빨강',
    },
  },
  {
    id: 'sen-vang',
    plates: ['/wedding/backgrounds/sen-vang.jpg'],
    ornaments: LOTUS_ORNAMENTS,
    coverPresetId: 'sen_vang',
    look: LOTUS_LOOK,
    label: {
      vi: 'Sen vàng',
      en: 'Gold lotus',
      zh: '金莲',
      ja: '金の蓮',
      ko: '금색 연꽃',
    },
  },
  {
    id: 'hong-ngoc-trai',
    plates: [
      '/wedding/backgrounds/hong-ngoc-trai-1.jpg',
      '/wedding/backgrounds/hong-ngoc-trai-wash.jpg',
      '/wedding/backgrounds/hong-ngoc-trai-2.jpg',
    ],
    ornaments: PEARL_ORNAMENTS,
    coverPresetId: 'pearl_rose',
    look: PEARL_LOOK,
    label: {
      vi: 'Hồng ngọc trai',
      en: 'Pearl blush',
      zh: '珍珠粉霞',
      ja: 'パールブラッシュ',
      ko: '펄 블러시',
    },
  },
  {
    id: 'vuon-hong-troi',
    plates: ['/wedding/backgrounds/vuon-hong-troi.jpg'],
    ornaments: SKY_ORNAMENTS,
    coverPresetId: 'vuon_hong_troi',
    look: SKY_LOOK,
    label: {
      vi: 'Vườn hồng trời',
      en: 'Rose garden sky',
      zh: '玫瑰蓝天',
      ja: '薔薇の青空',
      ko: '장미 하늘',
    },
  },
  {
    id: 'hoa-moc-xanh',
    plates: ['/wedding/backgrounds/hoa-moc-xanh-paper.jpg'],
    ornaments: MOC_ORNAMENTS,
    coverPresetId: 'moc_portrait',
    look: MOC_LOOK,
    label: {
      vi: 'Hoa mộc xanh',
      en: 'Green wood flower',
      zh: '青木花',
      ja: '青木の花',
      ko: '푸른 나뭇꽃',
    },
  },
  {
    id: 'to-duyen-xanh',
    plates: ['/wedding/backgrounds/to-duyen-xanh-paper.jpg'],
    ornaments: CALLA_ORNAMENTS,
    coverPresetId: 'to_duyen_xanh',
    look: CALLA_LOOK,
    label: {
      vi: 'Tơ duyên xanh',
      en: 'Sage calla',
      zh: '青瓷马蹄莲',
      ja: '青磁のカラー',
      ko: '세이지 칼라',
    },
  },
  {
    id: 'phong-bi-thu',
    plates: ['/wedding/backgrounds/phong-bi-paper.jpg'],
    ornaments: DO_DAM_ORNAMENTS,
    coverPresetId: 'phong_bi',
    look: DO_DAM_LOOK,
    label: {
      vi: 'Phong bì thư',
      en: 'Letter envelope',
      zh: '信封',
      ja: '封筒',
      ko: '편지 봉투',
    },
  },
  {
    id: 'do-dam',
    plates: ['/wedding/backgrounds/do-dam-paper.jpg'],
    ornaments: DO_DAM_ORNAMENTS,
    coverPresetId: 'do_dam',
    look: DO_DAM_LOOK,
    label: {
      vi: 'Đỏ đậm tối giản',
      en: 'Deep burgundy minimal',
      zh: '深酒红极简',
      ja: '深いバーガンディのミニマル',
      ko: '딥 버건디 미니멀',
    },
  },
]

const PRESET_BY_ID = new Map(WEDDING_BACKGROUND_PRESETS.map((preset) => [preset.id, preset]))

export function findWeddingBackgroundPreset(id: string | null | undefined): WeddingBackgroundPreset | undefined {
  const key = id?.trim() || ''
  return key ? PRESET_BY_ID.get(key) : undefined
}

export function labelForWeddingBackgroundPreset(locale: WebLocale, preset: WeddingBackgroundPreset): string {
  return preset.label[locale] ?? preset.label.en
}

const STYLE_COVER_FRAME: Record<string, { frame: string; buttonColorId: WeddingButtonColorId; coverRsvpColorId: WeddingButtonColorId }> = {
  floral: { frame: 'pearl_rose', buttonColorId: 'rose', coverRsvpColorId: 'blush' },
  traditional_vietnamese: { frame: 'plain_photo', buttonColorId: 'cream', coverRsvpColorId: 'ivory' },
  luxury: { frame: 'sen_vang', buttonColorId: 'gold', coverRsvpColorId: 'champagne' },
  vintage: { frame: 'sen_vang', buttonColorId: 'bronze', coverRsvpColorId: 'cream' },
  ethereal: { frame: 'pearl_rose', buttonColorId: 'chocolate', coverRsvpColorId: 'ivory' },
  minimal: { frame: 'pearl_rose', buttonColorId: 'black', coverRsvpColorId: 'ivory' },
  modern: { frame: 'sen_vang', buttonColorId: 'cream', coverRsvpColorId: 'gold' },
}

export function weddingFramePatchForStyle(styleId: string | null | undefined) {
  const match = STYLE_COVER_FRAME[styleId?.trim() || ''] ?? STYLE_COVER_FRAME.floral
  return {
    coverPresetId: match.frame,
    coverFrameMode: 'preset' as const,
    groomPortraitShellMode: 'preset' as const,
    groomPortraitShellPresetId: match.frame,
    bridePortraitShellMode: 'preset' as const,
    bridePortraitShellPresetId: match.frame,
    buttonColorId: match.buttonColorId,
    coverRsvpColorId: match.coverRsvpColorId,
  }
}

const STYLE_KIT_ID: Record<string, string> = {
  floral: 'vuon-kinh-hong',
  ethereal: 'vuon-kinh-hong',
  traditional_vietnamese: 'long-phung-do',
  luxury: 'sen-vang',
  vintage: 'sen-vang',
  modern: 'sen-vang',
  minimal: 'vuon-kinh-hong',
}

export function weddingAiBackgroundKit(styleId: string | null | undefined): WeddingBackgroundPreset {
  const style = styleId?.trim() || 'luxury'
  const source = findWeddingBackgroundPreset(STYLE_KIT_ID[style] || 'vuon-kinh-hong') ?? WEDDING_BACKGROUND_PRESETS[0]
  return { ...source, id: `ai-${style}`, plates: [] }
}

export function resolveWeddingChromeKit(input: {
  backgroundPresetId?: string
  backgroundKitStyleId?: string
}): WeddingBackgroundPreset | undefined {
  return findWeddingBackgroundPreset(input.backgroundPresetId) ?? (
    input.backgroundKitStyleId ? weddingAiBackgroundKit(input.backgroundKitStyleId) : undefined
  )
}

export type WeddingThemeOpenCelebration = {
  openBurstEffect: 'none' | 'bloom' | 'petals' | 'hearts' | 'stars' | 'fireworks' | 'gold' | 'butterflies'
  openFallEffect: 'none' | 'petals' | 'hearts' | 'stars' | 'fireworks' | 'gold' | 'snow' | 'confetti' | 'lanterns'
}

const DEFAULT_THEME_OPEN: WeddingThemeOpenCelebration = { openBurstEffect: 'bloom', openFallEffect: 'petals' }

/** Một kiểu bung và một kiểu rơi cho đúng chất chủ đề. */
const THEME_OPEN: Record<string, WeddingThemeOpenCelebration> = {
  'toi-gian-nau': { openBurstEffect: 'stars', openFallEffect: 'none' },
  'vuon-kinh-hong': { openBurstEffect: 'bloom', openFallEffect: 'petals' },
  'long-phung-do': { openBurstEffect: 'gold', openFallEffect: 'fireworks' },
  'do-son': { openBurstEffect: 'fireworks', openFallEffect: 'lanterns' },
  'song-hy-do': { openBurstEffect: 'gold', openFallEffect: 'lanterns' },
  'sen-vang': { openBurstEffect: 'bloom', openFallEffect: 'gold' },
  'hong-ngoc-trai': { openBurstEffect: 'butterflies', openFallEffect: 'petals' },
  'vuon-hong-troi': { openBurstEffect: 'butterflies', openFallEffect: 'stars' },
  'hoa-moc-xanh': { openBurstEffect: 'petals', openFallEffect: 'petals' },
  'to-duyen-xanh': { openBurstEffect: 'bloom', openFallEffect: 'none' },
  'do-dam': { openBurstEffect: 'petals', openFallEffect: 'petals' },
  'phong-bi-thu': { openBurstEffect: 'petals', openFallEffect: 'petals' },
  floral: { openBurstEffect: 'bloom', openFallEffect: 'petals' },
  ethereal: { openBurstEffect: 'stars', openFallEffect: 'petals' },
  traditional_vietnamese: { openBurstEffect: 'gold', openFallEffect: 'lanterns' },
  luxury: { openBurstEffect: 'bloom', openFallEffect: 'gold' },
  vintage: { openBurstEffect: 'petals', openFallEffect: 'petals' },
  modern: { openBurstEffect: 'stars', openFallEffect: 'gold' },
  minimal: { openBurstEffect: 'stars', openFallEffect: 'none' },
  'kho-hong-buom': { openBurstEffect: 'butterflies', openFallEffect: 'petals' },
  'kho-sen-hong': { openBurstEffect: 'bloom', openFallEffect: 'petals' },
  'kho-hac-sen': { openBurstEffect: 'gold', openFallEffect: 'lanterns' },
  'kho-hac-do': { openBurstEffect: 'gold', openFallEffect: 'gold' },
  'kho-phung-do': { openBurstEffect: 'fireworks', openFallEffect: 'gold' },
  'kho-mau-don': { openBurstEffect: 'bloom', openFallEffect: 'petals' },
  'kho-do-phap': { openBurstEffect: 'fireworks', openFallEffect: 'fireworks' },
}

export function weddingThemeOpenCelebration(key: string | null | undefined): WeddingThemeOpenCelebration {
  return THEME_OPEN[key?.trim() || ''] ?? DEFAULT_THEME_OPEN
}

export function weddingAiKitSectionPatch(styleId: string | null | undefined) {
  const style = styleId?.trim() || 'luxury'
  const kit = weddingAiBackgroundKit(style)
  return {
    backgroundPresetId: '',
    backgroundKitStyleId: style,
    ...weddingKitFramePatch(kit),
    buttonColorId: kit.look.buttonColorId,
    coverRsvpColorId: kit.look.coverRsvpColorId,
    ...weddingThemeOpenCelebration(style),
  }
}

export type WeddingLinkedFrame = {
  imageUrl: string
  hole: { x: number; y: number; w: number; h: number }
  panel: string
  ink: 'dark' | 'light'
  referenceImageUrl?: string
}

/** Khung AI vẽ cho đúng tấm nền, hoặc khung được dùng làm mẫu khi tạo tấm nền đó. */
export function findWeddingFrameForBackground(
  backgroundUrl: string | null | undefined,
  backgrounds: { imageUrl: string; referenceImageUrl?: string }[],
  frames: WeddingLinkedFrame[],
): WeddingLinkedFrame | undefined {
  const url = backgroundUrl?.trim() || ''
  if (!url) return undefined
  const designed = frames.find((frame) => frame.referenceImageUrl?.trim() === url)
  if (designed) return designed
  const reference = backgrounds.find((item) => item.imageUrl === url)?.referenceImageUrl?.trim() || ''
  if (!reference) return undefined
  return frames.find((frame) => frame.imageUrl === reference)
}

export function weddingPairedFrameSectionPatch(frame: WeddingLinkedFrame) {
  return {
    coverFrameMode: 'library' as const,
    coverAiFrameUrl: frame.imageUrl,
    coverAiFrameHole: frame.hole,
    coverAiFramePanel: frame.panel,
    coverAiFrameInk: frame.ink,
    groomPortraitShellMode: 'library' as const,
    groomPortraitShellUrl: frame.imageUrl,
    groomPortraitShellHole: frame.hole,
    groomPortraitShellPanel: frame.panel,
    bridePortraitShellMode: 'library' as const,
    bridePortraitShellUrl: frame.imageUrl,
    bridePortraitShellHole: frame.hole,
    bridePortraitShellPanel: frame.panel,
  }
}

export function weddingUsesPairedAiFrame(section: {
  backgroundPresetId?: string
  coverFrameMode?: string
  coverAiFrameUrl?: string
  coverFrameChosen?: boolean
}): boolean {
  if (section.backgroundPresetId || section.coverFrameChosen) return false
  const mode = section.coverFrameMode
  return (mode === 'library' || mode === 'ai') && Boolean(section.coverAiFrameUrl?.trim())
}

/** Bố cục ảnh của bộ nền. Khách không chọn bố cục riêng. */
export function weddingHeroPhotoLayout(preset: Pick<WeddingBackgroundPreset, 'heroPhotoLayout'> | null | undefined): 'single' | 'stack' {
  return preset?.heroPhotoLayout === 'stack' ? 'stack' : 'single'
}

function weddingKitPhotoIsBare(coverPresetId: string) {
  const cover = findWeddingCoverPreset(coverPresetId)
  return Boolean(cover && weddingCoverPresetFollowsBackground(cover) && !cover.frame)
}

export function weddingKitFramePatch(preset: WeddingBackgroundPreset) {
  const layout = weddingHeroPhotoLayout(preset)
  if (weddingKitPhotoIsBare(preset.coverPresetId)) {
    return {
      coverPresetId: preset.coverPresetId,
      coverFrameMode: 'preset' as const,
      heroPhotoLayout: layout,
      groomPortraitShellMode: 'none' as const,
      bridePortraitShellMode: 'none' as const,
    }
  }
  return {
    coverPresetId: preset.coverPresetId,
    coverFrameMode: 'preset' as const,
    heroPhotoLayout: layout,
    groomPortraitShellMode: 'preset' as const,
    groomPortraitShellPresetId: preset.coverPresetId,
    bridePortraitShellMode: 'preset' as const,
    bridePortraitShellPresetId: preset.coverPresetId,
  }
}

/** Nền có sẵn mang theo khung, màu nút và màu chữ. Gỡ khung ảnh riêng để giao diện mới hiện. */
export function weddingReadyBackgroundSectionPatch(preset: WeddingBackgroundPreset) {
  return {
    backgroundPresetId: preset.id,
    backgroundKitStyleId: '',
    ...weddingKitFramePatch(preset),
    buttonColorId: preset.look.buttonColorId,
    coverRsvpColorId: preset.look.coverRsvpColorId,
    coverAiFrameUrl: '',
    ...weddingThemeOpenCelebration(preset.id),
  }
}

export function applyWeddingKitTheme(theme: WeddingTheme, preset: WeddingBackgroundPreset | null | undefined): WeddingTheme {
  if (!preset) return theme
  const next: WeddingTheme = {
    ...theme,
    text: preset.look.textClass,
    mutedText: preset.look.mutedClass,
    accent: preset.look.accentClass,
    accentText: preset.look.accentTextClass,
  }
  if (preset.look.contentCard === 'scallop' && preset.look.paper) {
    const plate = 'wedding-song-hy-card'
    return {
      ...next,
      darkPaper: preset.look.paper,
      pageBg: 'bg-[#4e1018]',
      contentCard: 'scallop',
      panel: plate,
      panelStrong: plate,
      panelGlass: plate,
      panelUi: plate,
      textGlow: '[text-shadow:0_1px_0_rgba(255,248,236,0.4)]',
      textGlowHeading: '[text-shadow:0_1px_0_rgba(255,248,236,0.55)]',
      nav: 'border-[#e8c87a]/30 bg-[#4e1018]/92 text-[#f6e4b8] shadow-[0_4px_24px_rgba(0,0,0,0.28)]',
      ring: 'ring-[#e8c87a]/35',
    }
  }
  if (preset.look.surface !== 'dark' || !preset.look.paper) return next
  return {
    ...next,
    darkPaper: preset.look.paper,
    pageBg: 'bg-[#5c1018]',
    textGlow: GOLD_ON_RED_GLOW,
    textGlowHeading: GOLD_ON_RED_GLOW_HEADING,
    nav: 'border-[#e8c87a]/30 bg-[#4a0c16]/92 text-[#f6e4b8] shadow-[0_4px_24px_rgba(0,0,0,0.28)]',
    ring: 'ring-[#e8c87a]/35',
  }
}

/** Mặt đọc phía sau chữ khi hoa văn nền cắt ngang nét chữ. Giấy trơn thì không phủ. */
export function weddingReadingPlate(
  preset: WeddingBackgroundPreset | null | undefined,
  pageBackground: string,
  themeIsDark: boolean,
): string | undefined {
  if (!pageBackground.trim()) return undefined
  if (preset?.look.contentCard === 'scallop') return undefined
  if (preset?.look.surface === 'dark' && preset.look.paper) return preset.look.paper
  if (!preset || preset.id.startsWith('ai-')) return themeIsDark ? '#0f172a' : '#fff8f2'
  return undefined
}

export function weddingKitSurface(preset: WeddingBackgroundPreset | null | undefined): {
  className: string
  style?: CSSProperties
} {
  if (!preset) return { className: '' }
  return {
    className: preset.look.fontClass,
    style: { '--wedding-text-plate': preset.look.textPlate } as CSSProperties,
  }
}
