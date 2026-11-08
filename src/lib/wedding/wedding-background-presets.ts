import type { CSSProperties } from 'react'
import type { WebLocale } from '@/lib/i18n/config'
import type { WeddingButtonColorId } from '@/lib/wedding/wedding-button-colors'
import { findWeddingCoverPreset, WEDDING_LEAF_CARDS, WEDDING_MOON_CARDS, weddingCoverPresetFollowsBackground, type WeddingGateToneId, type WeddingLeafCard, type WeddingMoonCard } from '@/lib/wedding/wedding-cover-presets'
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
  /** Người dùng đã đặt hoa này. Không dồn về mép và không kéo các hoa khác theo. */
  free?: true
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

/** Hoa còn nằm trong một khổ. Hoa đã trải xuống nội dung, hoặc đã tự đặt, thì không lặp thêm. */
export function weddingOrnamentsAreOneSheet(items: readonly WeddingBackgroundOrnament[]) {
  const linked = items.filter((item) => !item.free)
  if (linked.length === 0) return false
  const tops = linked.filter((item) => item.anchor !== 'bottom')
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
  if (plain.free !== true) delete plain.free
  return plain
}

function ornamentTop(item: WeddingBackgroundOrnament) {
  return item.anchor === 'bottom' ? 100 - item.y : item.y
}

function ornamentSide(item: WeddingBackgroundOrnament): 'left' | 'right' {
  return item.x + item.w / 2 < 50 ? 'left' : 'right'
}

/** Phần hoa được tràn ra ngoài mép, phần trăm bề ngang tờ. Phần còn lại nằm trên tờ. */
function ornamentEdgeBleed(width: number) {
  return Math.round(Math.min(12, Math.max(4, width * 0.32)) * 10) / 10
}

/** Hoa bám mép: một phần ra ngoài tờ, không chìm hết để chỉ còn một mảnh. */
export function seatWeddingOrnamentOnEdge(item: WeddingBackgroundOrnament): WeddingBackgroundOrnament {
  const bleed = ornamentEdgeBleed(item.w)
  let x = item.x
  if (x < -bleed) x = -bleed
  const maxX = Math.round((100 + bleed - item.w) * 10) / 10
  if (x > maxX) x = maxX
  if (x === item.x) return item
  return { ...item, x }
}

/**
 * Hoa mẫu đang dồn một bên thì chia hai mép, lệch nhau cho khỏi đè.
 * Hoa đã tự đặt giữ nguyên chỗ.
 */
export function arrangeWeddingOrnamentsOnEdges(items: readonly WeddingBackgroundOrnament[]): WeddingBackgroundOrnament[] {
  const linked = items.filter((item) => !item.free)
  if (linked.length < 2 || !weddingOrnamentsAreOneSheet(linked)) return items.map((item) => ({ ...item }))
  const sides = linked.map(ornamentSide)
  const oneSide = sides.every((side) => side === sides[0])
  const piled = linked.some((item, index) =>
    linked.some((other, otherIndex) => otherIndex > index && Math.abs(item.x - other.x) < 8 && Math.abs(ornamentTop(item) - ornamentTop(other)) < 10),
  )
  if (!oneSide && !piled) return items.map((item) => ({ ...item }))
  let cursor = 0
  return items.map((item) => {
    if (item.free) return { ...item }
    const index = cursor
    cursor += 1
    const side = oneSide && index % 2 === 1 ? (ornamentSide(item) === 'left' ? 'right' : 'left') : ornamentSide(item)
    const row = Math.floor(index / 2)
    const y = Math.round((6 + (row % 4) * 14) * 10) / 10
    const x = side === 'left' ? -2 : Math.round((100 - Math.min(item.w, 30) - 1) * 10) / 10
    const placed = weddingOrnamentPlain({ ...item, x, y })
    delete placed.anchor
    return placed
  })
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
 * Một khổ giữ đúng chỗ đã đặt. Nội dung dài hơn thì lặp hoa chưa tự đặt xuống từng khổ,
 * thu nhỏ và đẩy sát mép — hai bên, lệch nhau, giữa trang còn chỗ cho chữ.
 * Hoa `free` chỉ hiện một lần, đúng chỗ đã kéo.
 */
export function repeatWeddingOrnamentsDown(items: readonly WeddingBackgroundOrnament[], pages: number): WeddingOrnamentPlacement[] {
  let count = Math.max(1, Math.min(12, Math.round(pages) || 1))
  const arranged = arrangeWeddingOrnamentsOnEdges(items)
  while (count > 1 && count * arranged.length > WEDDING_ORNAMENT_LIST_MAX) count -= 1
  if (count <= 1) return arranged.map((item, seed) => ({ ...seatWeddingOrnamentOnEdge(item), seed, page: 0 }))
  const span = 100 / count
  const placed: WeddingOrnamentPlacement[] = []
  for (let page = 0; page < count; page++) {
    const seen = { left: 0, right: 0 }
    arranged.forEach((item, seed) => {
      if (item.free) {
        if (page === 0) placed.push({ ...item, seed, page: 0 })
        return
      }
      const local = item.anchor === 'bottom' ? 100 - item.y : item.y
      const y = Math.round((page * span + (local / 100) * span) * 10) / 10
      if (page === 0) {
        placed.push({ ...seatWeddingOrnamentOnEdge({ ...item, anchor: 'top', y }), seed, page })
        return
      }
      const sideLeft = item.x + item.w / 2 < 50
      const order = sideLeft ? seen.left : seen.right
      if (sideLeft) seen.left += 1
      else seen.right += 1
      const drift = page % 2 === 0 ? 0 : Math.round(span * 0.06 * 10) / 10
      const w = Math.min(item.w, 18)
      const bleed = ornamentEdgeBleed(w)
      const yShift = Math.round(order * Math.min(12, span * 0.18) * 10) / 10
      const pageBottom = Math.round(((page + 1) * span - 2) * 10) / 10
      placed.push({
        ...item,
        anchor: 'top',
        x: sideLeft ? -bleed : Math.round((100 - w + bleed) * 10) / 10,
        y: Math.min(pageBottom, Math.round((y + drift + yShift) * 10) / 10),
        w,
        opacity: Math.min(item.opacity ?? 1, 0.82),
        seed,
        page,
      })
    })
  }
  return placed
}

/** Danh sách hoa đang thấy trên thiệp, kể cả bản lặp theo khổ. */
export function weddingOrnamentEditSheet(items: readonly WeddingBackgroundOrnament[], pages: number): WeddingBackgroundOrnament[] {
  const count = Math.max(1, Math.min(12, Math.round(pages) || 1))
  const tile = count > 1 && weddingOrnamentsAreOneSheet(items) ? count : 1
  return repeatWeddingOrnamentsDown(items, tile).map((item) => weddingOrnamentPlain(item))
}

/**
 * Sửa đúng hoa đang thấy. Nội dung dài thì tách các bản lặp ra trước,
 * kéo một hoa không làm hoa khác nhảy mép.
 */
export function editWeddingOrnamentAt(
  items: readonly WeddingBackgroundOrnament[],
  pages: number,
  visualIndex: number,
  patch: (Partial<WeddingBackgroundOrnament> & { anchor?: 'top' | 'bottom' | null }) | null,
): WeddingBackgroundOrnament[] {
  const sheet = weddingOrnamentEditSheet(items, pages)
  const expanded = sheet.length !== items.length
  if (patch == null) {
    const next = sheet.filter((_, index) => index !== visualIndex)
    return expanded ? next.map((item) => ({ ...weddingOrnamentPlain(item), free: true as const })) : next
  }
  if (!sheet[visualIndex]) return sheet
  const merged: WeddingBackgroundOrnament = { ...sheet[visualIndex], ...patch }
  if ('anchor' in patch) {
    if (patch.anchor == null) delete merged.anchor
    else merged.anchor = patch.anchor
  }
  const position = 'x' in patch || 'y' in patch
  return sheet.map((item, index) => {
    const chosen = index === visualIndex ? merged : item
    const plain = weddingOrnamentPlain(chosen)
    if (position && (expanded || index === visualIndex)) return { ...plain, free: true }
    return plain
  })
}

export type WeddingOrnamentBox = {
  top: number
  left: number
  width: number
  height: number
}

/** Chỗ thêm hoa: lần lượt mé trái, mé phải. Không thấy khung thì vẫn bám mép trên. */
export function weddingOrnamentEdgeSpot(index: number, width = 22): { x: number; y: number; w: number } {
  const w = Math.min(36, Math.max(8, width))
  const onLeft = Math.max(0, Math.round(index) || 0) % 2 === 0
  const row = Math.floor(Math.max(0, Math.round(index) || 0) / 2) % 5
  return {
    x: onLeft ? 0 : Math.round((100 - w) * 10) / 10,
    y: Math.round((6 + row * 14) * 10) / 10,
    w,
  }
}

/** Giữa màn hình đang nằm trong nội dung thiệp thì hoa mới thuộc nội dung, không phải vỏ. */
export function weddingOrnamentSurfaceInView(input: {
  letterTop: number
  letterBottom: number
  letterHeight: number
  viewCenterY: number
}): 'cover' | 'letter' {
  if (!(input.letterHeight > 40)) return 'cover'
  if (input.letterTop <= input.viewCenterY && input.letterBottom >= input.viewCenterY) return 'letter'
  return 'cover'
}

export function weddingOrnamentSpotInView(input: {
  frame: WeddingOrnamentBox
  view: WeddingOrnamentBox
  width?: number
  /** Hoa thứ mấy. Chẵn bám mé trái, lẻ bám mé phải. */
  index?: number
}): { x: number; y: number; w: number } {
  const w = input.width ?? 22
  const frame = input.frame
  const view = input.view
  const fallback = weddingOrnamentEdgeSpot(input.index ?? 0, w)
  if (frame.width < 1 || frame.height < 1 || view.width < 1 || view.height < 1) return fallback
  const top = Math.max(frame.top, view.top)
  const bottom = Math.min(frame.top + frame.height, view.top + view.height)
  const left = Math.max(frame.left, view.left)
  const right = Math.min(frame.left + frame.width, view.left + view.width)
  if (bottom - top < 1 || right - left < 1) return fallback
  const edge = weddingOrnamentEdgeSpot(input.index ?? 0, w)
  const rawY = ((top - frame.top) / frame.height) * 100 + edge.y
  return {
    x: edge.x,
    y: Math.round(Math.min(92, Math.max(0, rawY)) * 10) / 10,
    w: edge.w,
  }
}

/** Hoa mới đã nằm trong khung nhìn, hoặc chưa kịp có kích thước, thì không kéo trang. */
export function ornamentRevealNeedsScroll(box: WeddingOrnamentBox, view: WeddingOrnamentBox) {
  if (box.width < 4 || box.height < 4 || view.width < 1 || view.height < 1) return false
  const overlap =
    Math.max(0, Math.min(box.top + box.height, view.top + view.height) - Math.max(box.top, view.top)) *
    Math.max(0, Math.min(box.left + box.width, view.left + view.width) - Math.max(box.left, view.left))
  return overlap < 8
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

const GARDEN_LA = '/wedding/backgrounds/ornaments/garden-la.png'
const GARDEN_HONG = '/wedding/backgrounds/ornaments/garden-hong.png'
const GARDEN_EUCA = '/wedding/backgrounds/ornaments/garden-euca.png'
const GARDEN_NU = '/wedding/backgrounds/ornaments/garden-nu.png'
const DO_SON_CORNER = '/wedding/backgrounds/ornaments/do-son-corner.svg'
const DO_SON_SCROLL = '/wedding/backgrounds/ornaments/do-son-scroll.svg'
const DO_SON_CLOUD = '/wedding/backgrounds/ornaments/do-son-cloud.svg'
const DO_SON_KNOT = '/wedding/backgrounds/ornaments/do-son-knot.svg'
const DRIED_SPRIG = '/wedding/backgrounds/ornaments/dried-sprig.png'
const DRIED_CLOUD = '/wedding/backgrounds/ornaments/dried-gyp-cloud.png'
const DRIED_STRAW = '/wedding/backgrounds/ornaments/dried-straw.png'
const DRIED_TALL = '/wedding/backgrounds/ornaments/dried-gyp-tall.png'
const MOC_BLOOM = '/wedding/backgrounds/ornaments/moc-bloom.png'
const MOC_LEAF = '/wedding/backgrounds/ornaments/moc-leaf.png'
const MOC_SPRIG = '/wedding/backgrounds/ornaments/moc-sprig.png'
const MOC_NU = '/wedding/backgrounds/ornaments/moc-nu.png'
const MIST_SPRIG = '/wedding/backgrounds/ornaments/mist-sprig.png'
const CALLA_BLOOM = '/wedding/backgrounds/ornaments/calla-bloom.png'
const CALLA_STEM = '/wedding/backgrounds/ornaments/calla-stem.png'
const CALLA_LA = '/wedding/backgrounds/ornaments/calla-la.png'
const DO_DAM_PEONY = '/wedding/backgrounds/ornaments/do-dam-peony.png'
const DO_DAM_STEM = '/wedding/backgrounds/ornaments/do-dam-stem.png'
const DO_DAM_ROSE = '/wedding/backgrounds/ornaments/do-dam-rose.png'
const DO_DAM_LA = '/wedding/backgrounds/ornaments/do-dam-la.png'
const TRE_CANH = '/wedding/backgrounds/ornaments/tre-canh.png'
const TRE_HOA = '/wedding/backgrounds/ornaments/tre-hoa.png'
const TRE_LA = '/wedding/backgrounds/ornaments/tre-la.png'
const TRE_MANG = '/wedding/backgrounds/ornaments/tre-mang.png'
const DAO_CANH = '/wedding/backgrounds/ornaments/dao-canh.png'
const DAO_NU = '/wedding/backgrounds/ornaments/dao-nu.png'
const DAO_LA = '/wedding/backgrounds/ornaments/dao-la.png'
const DAO_CANH_DAI = '/wedding/backgrounds/ornaments/dao-canh-dai.png'
const BIEN_VO = '/wedding/backgrounds/ornaments/bien-vo.png'
const BIEN_CO = '/wedding/backgrounds/ornaments/bien-co.png'
const BIEN_SAO = '/wedding/backgrounds/ornaments/bien-sao.png'
const BIEN_SOI = '/wedding/backgrounds/ornaments/bien-soi.png'
const DEM_CANH = '/wedding/backgrounds/ornaments/dem-canh.png'
const DEM_HOA = '/wedding/backgrounds/ornaments/dem-hoa.png'
const LUA_DAI = '/wedding/backgrounds/ornaments/lua-dai.png'
const LUA_HOA = '/wedding/backgrounds/ornaments/lua-hoa.png'
const CHUA_SEN = '/wedding/backgrounds/ornaments/chua-sen.png'
const CHUA_LA = '/wedding/backgrounds/ornaments/chua-la.png'
const CHUA_NU = '/wedding/backgrounds/ornaments/chua-nu.png'
const CHUA_GU = '/wedding/backgrounds/ornaments/chua-gu.png'
const CHO_CUC = '/wedding/backgrounds/ornaments/cho-cuc.png'
const CHO_LA = '/wedding/backgrounds/ornaments/cho-la.png'
const CHO_SU = '/wedding/backgrounds/ornaments/cho-su.png'
const CHO_GIAY = '/wedding/backgrounds/ornaments/cho-giay.png'
const HA_LONG_DA = '/wedding/backgrounds/ornaments/ha-long-da.png'
const HA_LONG_CO = '/wedding/backgrounds/ornaments/ha-long-co.png'
const HA_LONG_SOI = '/wedding/backgrounds/ornaments/ha-long-soi.png'
const HA_LONG_RONG = '/wedding/backgrounds/ornaments/ha-long-rong.png'
const LANG_SEN = '/wedding/backgrounds/ornaments/lang-sen.png'
const LANG_LA = '/wedding/backgrounds/ornaments/lang-la.png'
const LANG_CUC = '/wedding/backgrounds/ornaments/lang-cuc.png'
const LANG_CANH_CUC = '/wedding/backgrounds/ornaments/lang-canh-cuc.png'
const QUE_CAU = '/wedding/backgrounds/ornaments/que-cau.png'
const QUE_LUA = '/wedding/backgrounds/ornaments/que-lua.png'
const QUE_HOA = '/wedding/backgrounds/ornaments/que-hoa.png'
const QUE_LA = '/wedding/backgrounds/ornaments/que-la.png'
const DUONG_LA = '/wedding/backgrounds/ornaments/duong-la.png'
const DUONG_HOA = '/wedding/backgrounds/ornaments/duong-hoa.png'
const DUONG_RE = '/wedding/backgrounds/ornaments/duong-re.png'
const DUONG_QUA = '/wedding/backgrounds/ornaments/duong-qua.png'
const NIGHT_PAPER = '#0c1830'
const PEARL_HONG = '/wedding/backgrounds/ornaments/pearl-hong.png'
const PEARL_HAT = '/wedding/backgrounds/ornaments/pearl-hat.png'
const PEARL_LA = '/wedding/backgrounds/ornaments/pearl-la.png'
const PEARL_NU = '/wedding/backgrounds/ornaments/pearl-nu.png'
const LONG_PHUNG_CLOUD = '/wedding/backgrounds/ornaments/long-phung-cloud.svg'
const LONG_PHUNG_WAVE = '/wedding/backgrounds/ornaments/long-phung-wave.svg'
const SONG_HY_SEAL = '/wedding/backgrounds/ornaments/song-hy-seal.svg'
const SONG_HY_CLOUD = '/wedding/backgrounds/ornaments/song-hy-cloud.svg'
const GOLD_VINE = '/wedding/backgrounds/ornaments/gold-vine.png'
const GOLD_PEONY = '/wedding/backgrounds/ornaments/gold-peony.png'
const GOLD_LEAF_SPRIG = '/wedding/backgrounds/ornaments/gold-leaf-sprig.png'
const GOLD_HEARTS = '/wedding/backgrounds/ornaments/gold-hearts.png'
const GOLD_BLOSSOM = '/wedding/backgrounds/ornaments/gold-blossom.png'
const SKY_BUOM = '/wedding/backgrounds/ornaments/sky-buom.png'
const SKY_HONG = '/wedding/backgrounds/ornaments/sky-hong.png'
const SKY_LA = '/wedding/backgrounds/ornaments/sky-la.png'
const SKY_NU = '/wedding/backgrounds/ornaments/sky-nu.png'
const SEN_VANG_SEN = '/wedding/backgrounds/ornaments/sen-vang-sen.png'
const SEN_VANG_GU = '/wedding/backgrounds/ornaments/sen-vang-gu.png'
const DEM_LA = '/wedding/backgrounds/ornaments/dem-la.png'
const DEM_SAO = '/wedding/backgrounds/ornaments/dem-sao.png'
const LUA_KIM = '/wedding/backgrounds/ornaments/lua-kim.png'
const LUA_LA = '/wedding/backgrounds/ornaments/lua-la.png'
const VAN_MIEU_MAI = '/wedding/backgrounds/ornaments/van-mieu-mai.png'
const VAN_MIEU_LA = '/wedding/backgrounds/ornaments/van-mieu-la.png'
const VAN_MIEU_NU = '/wedding/backgrounds/ornaments/van-mieu-nu.png'
const VAN_MIEU_DA = '/wedding/backgrounds/ornaments/van-mieu-da.png'

const SOFT_FONT = 'Palatino Linotype, Palatino, Cambria, Times New Roman, serif'
const FORMAL_FONT = 'Cambria, Palatino Linotype, Times New Roman, serif'

/** Bốn hoa bám hai mép mobile. Một phần tràn ra ngoài tờ, phần lớn vẫn nằm trên tờ. */
function themeEdgeOrnaments(a: string, b: string, c: string, d: string): readonly WeddingBackgroundOrnament[] {
  return [
    { src: a, x: -8, y: 2, w: 28, rotate: -8, opacity: 0.94 },
    { src: b, x: 78, y: 4, w: 26, rotate: 10, opacity: 0.86 },
    { src: c, x: -6, y: 20, w: 24, rotate: 6, opacity: 0.8 },
    { src: d, x: 76, y: 2, w: 26, rotate: 12, anchor: 'bottom', opacity: 0.86 },
  ]
}

/** Hồng, nụ, lá và bạch đàn chụp thật — không dùng bản màu nước. */
const GARDEN_ORNAMENTS: readonly WeddingBackgroundOrnament[] = themeEdgeOrnaments(GARDEN_HONG, GARDEN_EUCA, GARDEN_LA, GARDEN_NU)

/** Mây vàng nét mảnh và dây lá vàng, cùng chất với rồng phượng. */
const LONG_PHUNG_ORNAMENTS: readonly WeddingBackgroundOrnament[] = themeEdgeOrnaments(LONG_PHUNG_CLOUD, GOLD_VINE, LONG_PHUNG_WAVE, GOLD_PEONY)

/** Hồi văn góc, mây, cuốn và nút vàng, cùng nét dệt trên nền đỏ son. */
const SCARLET_ORNAMENTS: readonly WeddingBackgroundOrnament[] = themeEdgeOrnaments(DO_SON_CORNER, DO_SON_SCROLL, DO_SON_CLOUD, DO_SON_KNOT)

const LOTUS_ORNAMENTS: readonly WeddingBackgroundOrnament[] = themeEdgeOrnaments(SEN_VANG_SEN, GOLD_PEONY, SEN_VANG_GU, GOLD_LEAF_SPRIG)

const PEARL_ORNAMENTS: readonly WeddingBackgroundOrnament[] = themeEdgeOrnaments(PEARL_HONG, PEARL_HAT, PEARL_LA, PEARL_NU)

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
  textPlate: 'rgba(92,16,24,0.9)',
  fontClass: 'wedding-font-formal',
  shareFont: FORMAL_FONT,
  surface: 'dark',
  paper: '#5c1018',
}

/** Dấu song hỷ, mây vàng và hai tim vàng, bám mép. */
const SONG_HY_ORNAMENTS: readonly WeddingBackgroundOrnament[] = themeEdgeOrnaments(SONG_HY_SEAL, GOLD_HEARTS, SONG_HY_CLOUD, GOLD_BLOSSOM)

const SONG_HY_LOOK: WeddingKitLook = {
  styleId: 'traditional_vietnamese',
  buttonColorId: 'cream',
  coverRsvpColorId: 'ivory',
  ink: '#4a1218',
  muted: '#5c241c',
  accent: '#6e1824',
  textClass: 'text-[#4a1218]',
  mutedClass: 'text-[#5c241c]',
  accentClass: 'text-[#6e1824]',
  accentTextClass: 'text-[#4a1218]',
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
  textPlate: 'rgba(110,24,32,0.9)',
  fontClass: 'wedding-font-formal',
  shareFont: FORMAL_FONT,
  surface: 'dark',
  paper: '#6e1820',
}

const SKY_ORNAMENTS: readonly WeddingBackgroundOrnament[] = themeEdgeOrnaments(SKY_BUOM, SKY_HONG, SKY_LA, SKY_NU)

const SKY_LOOK: WeddingKitLook = {
  styleId: 'floral',
  buttonColorId: 'rose',
  coverRsvpColorId: 'blush',
  /** Mực đậm: nền là trời xanh và hoa trắng, xám xanh nhạt bị chìm. */
  ink: '#1a2836',
  muted: '#243648',
  accent: '#8a3450',
  textClass: 'text-[#1a2836]',
  mutedClass: 'text-[#243648]',
  accentClass: 'text-[#8a3450]',
  accentTextClass: 'text-[#6d2840]',
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

const LINEN_ORNAMENTS: readonly WeddingBackgroundOrnament[] = themeEdgeOrnaments(DRIED_SPRIG, DRIED_CLOUD, DRIED_TALL, DRIED_STRAW)

/** Hoa mộc, lá, nhài và nụ mộc chụp thật, bám mép, giữa trang trống cho chữ. */
const MOC_ORNAMENTS: readonly WeddingBackgroundOrnament[] = themeEdgeOrnaments(MOC_BLOOM, MOC_LEAF, MOC_SPRIG, MOC_NU)

/** Hoa rum, lá rum và baby bám mép. Ảnh để trần, không khung. */
const CALLA_ORNAMENTS: readonly WeddingBackgroundOrnament[] = themeEdgeOrnaments(CALLA_BLOOM, MIST_SPRIG, CALLA_STEM, CALLA_LA)

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

/** Mẫu đơn đỏ rượu, hồng kem, baby rượu và lá rượu, bám hai mép. */
const DO_DAM_ORNAMENTS: readonly WeddingBackgroundOrnament[] = themeEdgeOrnaments(DO_DAM_PEONY, DO_DAM_STEM, DO_DAM_ROSE, DO_DAM_LA)

/** Cành tre, hoa tre, lá tre và măng chụp thật, bám hai mép. */
const TRE_ORNAMENTS: readonly WeddingBackgroundOrnament[] = themeEdgeOrnaments(TRE_CANH, TRE_HOA, TRE_LA, TRE_MANG)

const TRE_LOOK: WeddingKitLook = {
  styleId: 'minimal',
  buttonColorId: 'forest',
  coverRsvpColorId: 'olive',
  ink: '#1a3324',
  muted: '#3d5a48',
  accent: '#2f6b45',
  textClass: 'text-[#1a3324]',
  mutedClass: 'text-[#3d5a48]',
  accentClass: 'text-[#2f6b45]',
  accentTextClass: 'text-[#1f4a32]',
  textPlate: 'rgba(247,250,244,0.82)',
  fontClass: 'wedding-font-soft',
  shareFont: SOFT_FONT,
}

/** Hoa đào nổi bám mép. Nền là một dải liền, không vẽ hoa vào tấm giấy. */
const DAO_ORNAMENTS: readonly WeddingBackgroundOrnament[] = themeEdgeOrnaments(DAO_CANH, DAO_NU, DAO_CANH_DAI, DAO_LA)

const DAO_LOOK: WeddingKitLook = {
  styleId: 'floral',
  buttonColorId: 'rose',
  coverRsvpColorId: 'blush',
  ink: '#5c2a38',
  muted: '#8a5362',
  accent: '#a34762',
  textClass: 'text-[#5c2a38]',
  mutedClass: 'text-[#8a5362]',
  accentClass: 'text-[#a34762]',
  accentTextClass: 'text-[#7a3148]',
  textPlate: 'rgba(255,246,244,0.82)',
  fontClass: 'wedding-font-soft',
  shareFont: SOFT_FONT,
}

const BIEN_ORNAMENTS: readonly WeddingBackgroundOrnament[] = themeEdgeOrnaments(BIEN_VO, BIEN_CO, BIEN_SAO, BIEN_SOI)

const BIEN_LOOK: WeddingKitLook = {
  styleId: 'minimal',
  buttonColorId: 'teal',
  coverRsvpColorId: 'ivory',
  ink: '#1a3c48',
  muted: '#4d6a74',
  accent: '#0f766e',
  textClass: 'text-[#1a3c48]',
  mutedClass: 'text-[#4d6a74]',
  accentClass: 'text-[#0f766e]',
  accentTextClass: 'text-[#115e59]',
  textPlate: 'rgba(255,250,244,0.82)',
  fontClass: 'wedding-font-soft',
  shareFont: SOFT_FONT,
}

const DEM_ORNAMENTS: readonly WeddingBackgroundOrnament[] = themeEdgeOrnaments(DEM_CANH, DEM_HOA, DEM_LA, DEM_SAO)

const DEM_LOOK: WeddingKitLook = {
  styleId: 'modern',
  buttonColorId: 'gold',
  coverRsvpColorId: 'champagne',
  ink: '#f3e6c8',
  muted: '#d9c7a2',
  accent: '#e6d3b3',
  textClass: 'text-[#f3e6c8]',
  mutedClass: 'text-[#d9c7a2]',
  accentClass: 'text-[#e6d3b3]',
  accentTextClass: 'text-[#f6e7c8]',
  textPlate: 'rgba(12,24,48,0.72)',
  fontClass: 'wedding-font-formal',
  shareFont: FORMAL_FONT,
  surface: 'dark',
  paper: NIGHT_PAPER,
}

const LUA_ORNAMENTS: readonly WeddingBackgroundOrnament[] = themeEdgeOrnaments(LUA_DAI, LUA_HOA, LUA_KIM, LUA_LA)

const LUA_LOOK: WeddingKitLook = {
  styleId: 'ethereal',
  buttonColorId: 'bronze',
  coverRsvpColorId: 'ivory',
  ink: '#3b2a22',
  muted: '#6e584c',
  accent: '#8a5727',
  textClass: 'text-[#3b2a22]',
  mutedClass: 'text-[#6e584c]',
  accentClass: 'text-[#8a5727]',
  accentTextClass: 'text-[#6b4318]',
  textPlate: 'rgba(255,250,244,0.78)',
  fontClass: 'wedding-font-soft',
  shareFont: SOFT_FONT,
}

/** Sen mái ngói: sen hồng, lá sen, nụ sen và gương sen, bám mép. */
const CHUA_ORNAMENTS: readonly WeddingBackgroundOrnament[] = themeEdgeOrnaments(CHUA_SEN, CHUA_LA, CHUA_NU, CHUA_GU)

const CHUA_LOOK: WeddingKitLook = {
  styleId: 'luxury',
  buttonColorId: 'gold',
  coverRsvpColorId: 'champagne',
  ink: '#3b2618',
  muted: '#6b5340',
  accent: '#8a5a12',
  textClass: 'text-[#3b2618]',
  mutedClass: 'text-[#6b5340]',
  accentClass: 'text-[#8a5a12]',
  accentTextClass: 'text-[#6b4310]',
  textPlate: 'rgba(255,248,236,0.9)',
  fontClass: 'wedding-font-lotus',
  shareFont: SOFT_FONT,
}

/** Văn Miếu: cành mai, lá mai, nụ mai và đá xám, bám mép. */
const VAN_MIEU_ORNAMENTS: readonly WeddingBackgroundOrnament[] = themeEdgeOrnaments(VAN_MIEU_MAI, VAN_MIEU_LA, VAN_MIEU_NU, VAN_MIEU_DA)

const VAN_MIEU_LOOK: WeddingKitLook = {
  styleId: 'vintage',
  buttonColorId: 'bronze',
  coverRsvpColorId: 'ivory',
  ink: '#2c2416',
  muted: '#5c4e3a',
  accent: '#6b4a28',
  textClass: 'text-[#2c2416]',
  mutedClass: 'text-[#5c4e3a]',
  accentClass: 'text-[#6b4a28]',
  accentTextClass: 'text-[#4a3218]',
  textPlate: 'rgba(255,250,240,0.9)',
  fontClass: 'wedding-font-formal',
  shareFont: FORMAL_FONT,
}

/** Chợ Bến Thành: cúc, lá, hoa sứ và hoa giấy, bám mép. */
const CHO_ORNAMENTS: readonly WeddingBackgroundOrnament[] = themeEdgeOrnaments(CHO_CUC, CHO_LA, CHO_SU, CHO_GIAY)

const CHO_LOOK: WeddingKitLook = {
  styleId: 'floral',
  buttonColorId: 'terracotta',
  coverRsvpColorId: 'cream',
  ink: '#5c2e1a',
  muted: '#8a5a40',
  accent: '#c2410c',
  textClass: 'text-[#5c2e1a]',
  mutedClass: 'text-[#8a5a40]',
  accentClass: 'text-[#c2410c]',
  accentTextClass: 'text-[#9a3412]',
  textPlate: 'rgba(255,248,240,0.9)',
  fontClass: 'wedding-font-soft',
  shareFont: SOFT_FONT,
}

/** Vịnh Hạ Long: đá, cỏ vịnh, sỏi karst và rong biển, bám mép. */
const HA_LONG_ORNAMENTS: readonly WeddingBackgroundOrnament[] = themeEdgeOrnaments(HA_LONG_DA, HA_LONG_CO, HA_LONG_SOI, HA_LONG_RONG)

const HA_LONG_LOOK: WeddingKitLook = {
  styleId: 'minimal',
  buttonColorId: 'sky',
  coverRsvpColorId: 'ivory',
  ink: '#12343a',
  muted: '#4d6a70',
  accent: '#0369a1',
  textClass: 'text-[#12343a]',
  mutedClass: 'text-[#4d6a70]',
  accentClass: 'text-[#0369a1]',
  accentTextClass: 'text-[#0c4a6e]',
  textPlate: 'rgba(248,252,250,0.9)',
  fontClass: 'wedding-font-soft',
  shareFont: SOFT_FONT,
}

/** Lăng Bác: sen trắng, lá sen và cúc trắng, bám mép. */
const LANG_ORNAMENTS: readonly WeddingBackgroundOrnament[] = themeEdgeOrnaments(LANG_SEN, LANG_LA, LANG_CUC, LANG_CANH_CUC)

const LANG_LOOK: WeddingKitLook = {
  styleId: 'minimal',
  buttonColorId: 'slate',
  coverRsvpColorId: 'ivory',
  ink: '#243038',
  muted: '#4e5c62',
  accent: '#3d5c4a',
  textClass: 'text-[#243038]',
  mutedClass: 'text-[#4e5c62]',
  accentClass: 'text-[#3d5c4a]',
  accentTextClass: 'text-[#243830]',
  textPlate: 'rgba(255,252,248,0.9)',
  fontClass: 'wedding-font-formal',
  shareFont: FORMAL_FONT,
}

/** Quê Bác: lá cau, bông lúa, hoa dại và lá lúa, bám mép. */
const QUE_ORNAMENTS: readonly WeddingBackgroundOrnament[] = themeEdgeOrnaments(QUE_CAU, QUE_LUA, QUE_HOA, QUE_LA)

const QUE_LOOK: WeddingKitLook = {
  styleId: 'vintage',
  buttonColorId: 'olive',
  coverRsvpColorId: 'cream',
  ink: '#3a3320',
  muted: '#6b6048',
  accent: '#6b5a28',
  textClass: 'text-[#3a3320]',
  mutedClass: 'text-[#6b6048]',
  accentClass: 'text-[#6b5a28]',
  accentTextClass: 'text-[#4a3e18]',
  textPlate: 'rgba(255,248,232,0.9)',
  fontClass: 'wedding-font-soft',
  shareFont: SOFT_FONT,
}

/** Đường Lâm: lá đa, hoa làng, rễ đa và đá ong, bám mép. */
const DUONG_ORNAMENTS: readonly WeddingBackgroundOrnament[] = themeEdgeOrnaments(DUONG_LA, DUONG_HOA, DUONG_RE, DUONG_QUA)

const DUONG_LOOK: WeddingKitLook = {
  styleId: 'vintage',
  buttonColorId: 'chocolate',
  coverRsvpColorId: 'ivory',
  ink: '#3b2a22',
  muted: '#6e584c',
  accent: '#8a5727',
  textClass: 'text-[#3b2a22]',
  mutedClass: 'text-[#6e584c]',
  accentClass: 'text-[#8a5727]',
  accentTextClass: 'text-[#6b4318]',
  textPlate: 'rgba(255,246,238,0.9)',
  fontClass: 'wedding-font-formal',
  shareFont: FORMAL_FONT,
}

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

const MOON_PAPER_KIT: Record<WeddingGateToneId, { plates: readonly string[]; ornaments: readonly WeddingBackgroundOrnament[]; look: WeddingKitLook }> = {
  lacquer: { plates: ['/wedding/backgrounds/song-hy-do.svg'], ornaments: SONG_HY_ORNAMENTS, look: SONG_HY_LOOK },
  lotus: { plates: ['/wedding/backgrounds/sen-vang.jpg'], ornaments: LOTUS_ORNAMENTS, look: LOTUS_LOOK },
  pearl: {
    plates: [
      '/wedding/backgrounds/hong-ngoc-trai-1.jpg',
      '/wedding/backgrounds/hong-ngoc-trai-wash.jpg',
      '/wedding/backgrounds/hong-ngoc-trai-2.jpg',
    ],
    ornaments: PEARL_ORNAMENTS,
    look: PEARL_LOOK,
  },
  night: { plates: ['/wedding/backgrounds/dem-vang-paper.jpg'], ornaments: DEM_ORNAMENTS, look: DEM_LOOK },
  sea: { plates: ['/wedding/backgrounds/bien-paper.jpg'], ornaments: BIEN_ORNAMENTS, look: BIEN_LOOK },
}

function moonBackgroundPreset(card: WeddingMoonCard): WeddingBackgroundPreset {
  const kit = MOON_PAPER_KIT[card.paper]
  return {
    id: card.backgroundId,
    plates: kit.plates,
    ornaments: kit.ornaments,
    coverPresetId: card.coverId,
    look: kit.look,
    label: card.label,
  }
}

function leafBackgroundPreset(card: WeddingLeafCard): WeddingBackgroundPreset {
  const kit = MOON_PAPER_KIT[card.paper]
  return {
    id: card.backgroundId,
    plates: kit.plates,
    ornaments: kit.ornaments,
    coverPresetId: card.coverId,
    look: kit.look,
    label: card.label,
  }
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
    id: 're-quat',
    plates: ['/wedding/backgrounds/song-hy-do.svg'],
    ornaments: SONG_HY_ORNAMENTS,
    coverPresetId: 're_quat',
    look: SONG_HY_LOOK,
    label: {
      vi: 'Rẻ quạt đỏ',
      en: 'Red folding fan',
      zh: '红折扇',
      ja: '赤の扇',
      ko: '붉은 부채',
    },
  },
  {
    id: 're-quat-sen',
    plates: ['/wedding/backgrounds/sen-vang.jpg'],
    ornaments: LOTUS_ORNAMENTS,
    coverPresetId: 're_quat_sen',
    look: LOTUS_LOOK,
    label: {
      vi: 'Rẻ quạt sen vàng',
      en: 'Gold lotus fan',
      zh: '金莲折扇',
      ja: '金蓮の扇',
      ko: '금련 부채',
    },
  },
  {
    id: 're-quat-ngoc',
    plates: [
      '/wedding/backgrounds/hong-ngoc-trai-1.jpg',
      '/wedding/backgrounds/hong-ngoc-trai-wash.jpg',
      '/wedding/backgrounds/hong-ngoc-trai-2.jpg',
    ],
    ornaments: PEARL_ORNAMENTS,
    coverPresetId: 're_quat_ngoc',
    look: PEARL_LOOK,
    label: {
      vi: 'Rẻ quạt ngọc trai',
      en: 'Pearl fan',
      zh: '珍珠折扇',
      ja: '真珠の扇',
      ko: '진주 부채',
    },
  },
  {
    id: 're-quat-dem',
    plates: ['/wedding/backgrounds/dem-vang-paper.jpg'],
    ornaments: DEM_ORNAMENTS,
    coverPresetId: 're_quat_dem',
    look: DEM_LOOK,
    label: {
      vi: 'Rẻ quạt đêm vàng',
      en: 'Gold night fan',
      zh: '夜金折扇',
      ja: '金の夜の扇',
      ko: '금빛 밤 부채',
    },
  },
  {
    id: 're-quat-bien',
    plates: ['/wedding/backgrounds/bien-paper.jpg'],
    ornaments: BIEN_ORNAMENTS,
    coverPresetId: 're_quat_bien',
    look: BIEN_LOOK,
    label: {
      vi: 'Rẻ quạt biển',
      en: 'Seaside fan',
      zh: '海边折扇',
      ja: '海辺の扇',
      ko: '해변 부채',
    },
  },
  {
    id: 'vom-sen',
    plates: ['/wedding/backgrounds/sen-vang.jpg'],
    ornaments: LOTUS_ORNAMENTS,
    coverPresetId: 'vom_sen',
    look: LOTUS_LOOK,
    label: {
      vi: 'Vòm sen vàng',
      en: 'Gold lotus arch',
      zh: '金莲拱门',
      ja: '金蓮のアーチ',
      ko: '금련 아치',
    },
  },
  {
    id: 'vom-ngoc',
    plates: [
      '/wedding/backgrounds/hong-ngoc-trai-1.jpg',
      '/wedding/backgrounds/hong-ngoc-trai-wash.jpg',
      '/wedding/backgrounds/hong-ngoc-trai-2.jpg',
    ],
    ornaments: PEARL_ORNAMENTS,
    coverPresetId: 'vom_ngoc',
    look: PEARL_LOOK,
    label: {
      vi: 'Vòm ngọc trai',
      en: 'Pearl arch',
      zh: '珍珠拱门',
      ja: '真珠のアーチ',
      ko: '진주 아치',
    },
  },
  {
    id: 'vom-dem',
    plates: ['/wedding/backgrounds/dem-vang-paper.jpg'],
    ornaments: DEM_ORNAMENTS,
    coverPresetId: 'vom_dem',
    look: DEM_LOOK,
    label: {
      vi: 'Vòm đêm vàng',
      en: 'Gold night arch',
      zh: '夜金拱门',
      ja: '金の夜のアーチ',
      ko: '금빛 밤 아치',
    },
  },
  {
    id: 'vom-bien',
    plates: ['/wedding/backgrounds/bien-paper.jpg'],
    ornaments: BIEN_ORNAMENTS,
    coverPresetId: 'vom_bien',
    look: BIEN_LOOK,
    label: {
      vi: 'Vòm biển',
      en: 'Seaside arch',
      zh: '海边拱门',
      ja: '海辺のアーチ',
      ko: '해변 아치',
    },
  },
  ...WEDDING_MOON_CARDS.map(moonBackgroundPreset),
  ...WEDDING_LEAF_CARDS.map(leafBackgroundPreset),
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
    id: 'doi-anh-nau',
    plates: ['/wedding/backgrounds/toi-gian-nau.jpg'],
    ornaments: LINEN_ORNAMENTS,
    coverPresetId: 'pair_nau',
    look: LINEN_LOOK,
    label: {
      vi: 'Đôi ảnh nâu',
      en: 'Two warm photos',
      zh: '暖色双照',
      ja: 'あたたかい写真二つ',
      ko: '따뜻한 사진 둘',
    },
  },
  {
    id: 'doi-anh-hong',
    plates: ['/wedding/backgrounds/vuon-kinh-hong-wash.jpg'],
    ornaments: GARDEN_ORNAMENTS,
    coverPresetId: 'pair_hong',
    look: GARDEN_LOOK,
    label: {
      vi: 'Đôi ảnh hồng',
      en: 'Two pink photos',
      zh: '粉色双照',
      ja: 'ピンクの写真二つ',
      ko: '분홍 사진 둘',
    },
  },
  {
    id: 'doi-anh-long-phung',
    plates: ['/wedding/backgrounds/long-phung-do-1.jpg', '/wedding/backgrounds/long-phung-do-2.jpg'],
    ornaments: LONG_PHUNG_ORNAMENTS,
    coverPresetId: 'pair_long_phung',
    look: RED_LOOK,
    label: {
      vi: 'Đôi ảnh long phụng',
      en: 'Two dragon photos',
      zh: '龙凤双照',
      ja: '龍鳳の写真二つ',
      ko: '용봉 사진 둘',
    },
  },
  {
    id: 'doi-anh-do-son',
    plates: ['/wedding/backgrounds/do-son.jpg'],
    ornaments: SCARLET_ORNAMENTS,
    coverPresetId: 'pair_do_son',
    look: SCARLET_LOOK,
    label: {
      vi: 'Đôi ảnh đỏ son',
      en: 'Two scarlet photos',
      zh: '正红双照',
      ja: '朱色の写真二つ',
      ko: '진홍 사진 둘',
    },
  },
  {
    id: 'doi-anh-song-hy',
    plates: ['/wedding/backgrounds/song-hy-do.svg'],
    ornaments: SONG_HY_ORNAMENTS,
    coverPresetId: 'pair_song_hy',
    look: SONG_HY_LOOK,
    label: {
      vi: 'Đôi ảnh song hỷ',
      en: 'Two happiness photos',
      zh: '双喜双照',
      ja: '双喜の写真二つ',
      ko: '쌍희 사진 둘',
    },
  },
  {
    id: 'doi-anh-sen',
    plates: ['/wedding/backgrounds/sen-vang.jpg'],
    ornaments: LOTUS_ORNAMENTS,
    coverPresetId: 'pair_sen',
    look: LOTUS_LOOK,
    label: {
      vi: 'Đôi ảnh sen',
      en: 'Two lotus photos',
      zh: '金莲双照',
      ja: '蓮の写真二つ',
      ko: '연꽃 사진 둘',
    },
  },
  {
    id: 'doi-anh-ngoc',
    plates: [
      '/wedding/backgrounds/hong-ngoc-trai-1.jpg',
      '/wedding/backgrounds/hong-ngoc-trai-wash.jpg',
      '/wedding/backgrounds/hong-ngoc-trai-2.jpg',
    ],
    ornaments: PEARL_ORNAMENTS,
    coverPresetId: 'pair_ngoc',
    look: PEARL_LOOK,
    label: {
      vi: 'Đôi ảnh ngọc',
      en: 'Two pearl photos',
      zh: '珍珠双照',
      ja: 'パールの写真二つ',
      ko: '펄 사진 둘',
    },
  },
  {
    id: 'doi-anh-lech',
    plates: ['/wedding/backgrounds/toi-gian-nau.jpg'],
    ornaments: LINEN_ORNAMENTS,
    coverPresetId: 'pair_lech',
    look: LINEN_LOOK,
    label: {
      vi: 'Đôi ảnh lệch',
      en: 'Offset photos',
      zh: '错落双照',
      ja: 'ずらし写真',
      ko: '어긋난 사진',
    },
  },
  {
    id: 'doi-anh-nghieng',
    plates: ['/wedding/backgrounds/vuon-kinh-hong-wash.jpg'],
    ornaments: GARDEN_ORNAMENTS,
    coverPresetId: 'pair_nghieng',
    look: GARDEN_LOOK,
    label: {
      vi: 'Đôi ảnh nghiêng',
      en: 'Tilted photos',
      zh: '倾斜双照',
      ja: '傾けた写真',
      ko: '기울인 사진',
    },
  },
  {
    id: 'doi-anh-vong',
    plates: ['/wedding/backgrounds/song-hy-do.svg'],
    ornaments: SONG_HY_ORNAMENTS,
    coverPresetId: 'pair_vong',
    look: SONG_HY_LOOK,
    label: {
      vi: 'Đôi ảnh vòng',
      en: 'Two round photos',
      zh: '双圆照',
      ja: '丸い写真二つ',
      ko: '둥근 사진 둘',
    },
  },
  {
    id: 'doi-anh-the',
    plates: ['/wedding/backgrounds/long-phung-do-1.jpg', '/wedding/backgrounds/long-phung-do-2.jpg'],
    ornaments: LONG_PHUNG_ORNAMENTS,
    coverPresetId: 'pair_the',
    look: RED_LOOK,
    label: {
      vi: 'Đôi ảnh thẻ',
      en: 'Photo cards',
      zh: '拍立得双照',
      ja: 'プリント写真',
      ko: '인화 사진',
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
      vi: 'Phong bì đỏ đô',
      en: 'Burgundy envelope',
      zh: '酒红信封',
      ja: 'バーガンディの封筒',
      ko: '버건디 봉투',
    },
  },
  {
    id: 'phong-bi-hong',
    plates: ['/wedding/backgrounds/phong-bi-hong-paper.jpg'],
    ornaments: GARDEN_ORNAMENTS,
    coverPresetId: 'phong_bi_hong',
    look: DAO_LOOK,
    label: {
      vi: 'Phong bì hồng',
      en: 'Blush envelope',
      zh: '粉信封',
      ja: '淡いピンクの封筒',
      ko: '블러시 봉투',
    },
  },
  {
    id: 'phong-bi-reu',
    plates: ['/wedding/backgrounds/phong-bi-reu-paper.jpg'],
    ornaments: CALLA_ORNAMENTS,
    coverPresetId: 'phong_bi_reu',
    look: CALLA_LOOK,
    label: {
      vi: 'Phong bì rêu',
      en: 'Sage envelope',
      zh: '苔绿信封',
      ja: 'セージの封筒',
      ko: '세이지 봉투',
    },
  },
  {
    id: 'phong-bi-dem',
    plates: ['/wedding/backgrounds/phong-bi-dem-paper.jpg'],
    ornaments: DEM_ORNAMENTS,
    coverPresetId: 'phong_bi_dem',
    look: DEM_LOOK,
    label: {
      vi: 'Phong bì đêm',
      en: 'Navy envelope',
      zh: '夜蓝信封',
      ja: '紺の封筒',
      ko: '네이비 봉투',
    },
  },
  {
    id: 'phong-bi-nga',
    plates: ['/wedding/backgrounds/phong-bi-nga-paper.jpg'],
    ornaments: LUA_ORNAMENTS,
    coverPresetId: 'phong_bi_nga',
    look: LUA_LOOK,
    label: {
      vi: 'Phong bì ngà',
      en: 'Ivory envelope',
      zh: '象牙信封',
      ja: '象牙色の封筒',
      ko: '아이보리 봉투',
    },
  },
  {
    id: 'hoa-dao',
    plates: ['/wedding/backgrounds/hoa-dao-paper.jpg'],
    ornaments: DAO_ORNAMENTS,
    coverPresetId: 'hoa_dao',
    look: DAO_LOOK,
    label: {
      vi: 'Hoa đào',
      en: 'Peach blossom',
      zh: '桃花',
      ja: '桃の花',
      ko: '복숭아꽃',
    },
  },
  {
    id: 'bien',
    plates: ['/wedding/backgrounds/bien-paper.jpg'],
    ornaments: BIEN_ORNAMENTS,
    coverPresetId: 'bien',
    look: BIEN_LOOK,
    label: {
      vi: 'Biển',
      en: 'Seaside',
      zh: '海边',
      ja: '海辺',
      ko: '해변',
    },
  },
  {
    id: 'dem-vang',
    plates: ['/wedding/backgrounds/dem-vang-paper.jpg'],
    ornaments: DEM_ORNAMENTS,
    coverPresetId: 'dem_vang',
    look: DEM_LOOK,
    label: {
      vi: 'Đêm vàng',
      en: 'Gold night',
      zh: '夜金',
      ja: '金の夜',
      ko: '금빛 밤',
    },
  },
  {
    id: 'lua-ao-dai',
    plates: ['/wedding/backgrounds/lua-ao-dai-paper.jpg'],
    ornaments: LUA_ORNAMENTS,
    coverPresetId: 'lua_ao_dai',
    look: LUA_LOOK,
    label: {
      vi: 'Lụa áo dài',
      en: 'Ao dai silk',
      zh: '奥黛丝绸',
      ja: 'アオザイの絹',
      ko: '아오자이 실크',
    },
  },
  {
    id: 'hoa-dao-van',
    plates: ['/wedding/backgrounds/hoa-dao-van-paper.jpg'],
    ornaments: DAO_ORNAMENTS,
    coverPresetId: 'hoa_dao_van',
    look: DAO_LOOK,
    label: {
      vi: 'Hoa đào hoa văn',
      en: 'Patterned peach blossom',
      zh: '桃花纹',
      ja: '桃の花模様',
      ko: '복숭아꽃 무늬',
    },
  },
  {
    id: 'bien-van',
    plates: ['/wedding/backgrounds/bien-van-paper.jpg'],
    ornaments: BIEN_ORNAMENTS,
    coverPresetId: 'bien_van',
    look: BIEN_LOOK,
    label: {
      vi: 'Biển hoa văn',
      en: 'Patterned seaside',
      zh: '海边纹',
      ja: '海辺の模様',
      ko: '해변 무늬',
    },
  },
  {
    id: 'dem-vang-van',
    plates: ['/wedding/backgrounds/dem-vang-van-paper.jpg'],
    ornaments: DEM_ORNAMENTS,
    coverPresetId: 'dem_vang_van',
    look: DEM_LOOK,
    label: {
      vi: 'Đêm vàng hoa văn',
      en: 'Patterned gold night',
      zh: '夜金纹',
      ja: '金の夜の模様',
      ko: '금빛 밤 무늬',
    },
  },
  {
    id: 'lua-van',
    plates: ['/wedding/backgrounds/lua-van-paper.jpg'],
    ornaments: LUA_ORNAMENTS,
    coverPresetId: 'lua_van',
    look: LUA_LOOK,
    label: {
      vi: 'Lụa hoa văn',
      en: 'Patterned silk',
      zh: '丝绸纹',
      ja: '絹の模様',
      ko: '실크 무늬',
    },
  },
  {
    id: 'tre-viet',
    plates: ['/wedding/backgrounds/tre-viet-paper.jpg'],
    ornaments: TRE_ORNAMENTS,
    coverPresetId: 'tre_viet',
    look: TRE_LOOK,
    label: {
      vi: 'Tre Việt Nam',
      en: 'Vietnamese bamboo',
      zh: '越南竹',
      ja: 'ベトナムの竹',
      ko: '베트남 대나무',
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
  {
    id: 'chua-mot-cot',
    plates: ['/wedding/backgrounds/chua-mot-cot-paper.jpg'],
    ornaments: CHUA_ORNAMENTS,
    coverPresetId: 'chua_mot_cot',
    look: CHUA_LOOK,
    label: {
      vi: 'Sen mái ngói',
      en: 'Lotus and roof tiles',
      zh: '莲与瓦檐',
      ja: '蓮と瓦屋根',
      ko: '연꽃과 기와',
    },
  },
  {
    id: 'van-mieu',
    plates: ['/wedding/backgrounds/van-mieu-paper.jpg'],
    ornaments: VAN_MIEU_ORNAMENTS,
    coverPresetId: 'van_mieu',
    look: VAN_MIEU_LOOK,
    label: {
      vi: 'Hoa đào gạch',
      en: 'Blossom on brick',
      zh: '砖墙桃花',
      ja: '煉瓦と桃の花',
      ko: '벽돌과 복숭아꽃',
    },
  },
  {
    id: 'cho-ben-thanh',
    plates: ['/wedding/backgrounds/cho-ben-thanh-paper.jpg'],
    ornaments: CHO_ORNAMENTS,
    coverPresetId: 'cho_ben_thanh',
    look: CHO_LOOK,
    label: {
      vi: 'Hoa sứ giấy',
      en: 'Plumeria and bougainvillea',
      zh: '鸡蛋花与三角梅',
      ja: 'プルメリアとブーゲンビリア',
      ko: '플루메리아와 부겐빌레아',
    },
  },
  {
    id: 'vinh-ha-long',
    plates: ['/wedding/backgrounds/vinh-ha-long-paper.jpg'],
    ornaments: HA_LONG_ORNAMENTS,
    coverPresetId: 'vinh_ha_long',
    look: HA_LONG_LOOK,
    label: {
      vi: 'Vịnh đá sương',
      en: 'Misty limestone bay',
      zh: '雾中石湾',
      ja: '霧の岩の湾',
      ko: '안개 낀 바위 만',
    },
  },
  {
    id: 'lang-bac',
    plates: ['/wedding/backgrounds/lang-bac-paper.jpg'],
    ornaments: LANG_ORNAMENTS,
    coverPresetId: 'lang_bac',
    look: LANG_LOOK,
    label: {
      vi: 'Cúc trắng',
      en: 'White chrysanthemums',
      zh: '白菊',
      ja: '白い菊',
      ko: '흰 국화',
    },
  },
  {
    id: 'que-nghe-an',
    plates: ['/wedding/backgrounds/que-nghe-an-paper.jpg'],
    ornaments: QUE_ORNAMENTS,
    coverPresetId: 'que_nghe_an',
    look: QUE_LOOK,
    label: {
      vi: 'Lúa lá cau',
      en: 'Rice and areca leaves',
      zh: '稻穗与槟榔叶',
      ja: '稲穂とビンロウの葉',
      ko: '벼 이삭과 빈랑 잎',
    },
  },
  {
    id: 'duong-lam',
    plates: ['/wedding/backgrounds/duong-lam-paper.jpg'],
    ornaments: DUONG_ORNAMENTS,
    coverPresetId: 'duong_lam',
    look: DUONG_LOOK,
    label: {
      vi: 'Đá ong lá đa',
      en: 'Laterite and bodhi leaves',
      zh: '红砖与菩提叶',
      ja: 'ラテライトと菩提の葉',
      ko: '라테라이트와 보리수 잎',
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
  ethereal: { frame: 'net_mong', buttonColorId: 'chocolate', coverRsvpColorId: 'ivory' },
  minimal: { frame: 'plain_photo', buttonColorId: 'black', coverRsvpColorId: 'ivory' },
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

/** Chủ đề không phải hồng thì không mượn khung hoa hồng của vườn kính. */
const STYLE_FRAME_OVERRIDE: Record<string, string> = {
  ethereal: 'net_mong',
  minimal: 'plain_photo',
}

export function weddingAiBackgroundKit(styleId: string | null | undefined): WeddingBackgroundPreset {
  const style = styleId?.trim() || 'luxury'
  const source = findWeddingBackgroundPreset(STYLE_KIT_ID[style] || 'vuon-kinh-hong') ?? WEDDING_BACKGROUND_PRESETS[0]
  const coverPresetId = STYLE_FRAME_OVERRIDE[style] || source.coverPresetId
  return { ...source, id: `ai-${style}`, plates: [], coverPresetId }
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

const MOON_THEME_OPEN: Record<WeddingGateToneId, WeddingThemeOpenCelebration> = {
  lacquer: { openBurstEffect: 'gold', openFallEffect: 'lanterns' },
  lotus: { openBurstEffect: 'bloom', openFallEffect: 'gold' },
  pearl: { openBurstEffect: 'butterflies', openFallEffect: 'petals' },
  night: { openBurstEffect: 'stars', openFallEffect: 'gold' },
  sea: { openBurstEffect: 'petals', openFallEffect: 'none' },
}

/** Một kiểu bung và một kiểu rơi cho đúng chất chủ đề. */
const THEME_OPEN: Record<string, WeddingThemeOpenCelebration> = {
  'toi-gian-nau': { openBurstEffect: 'stars', openFallEffect: 'none' },
  'vuon-kinh-hong': { openBurstEffect: 'bloom', openFallEffect: 'petals' },
  'long-phung-do': { openBurstEffect: 'gold', openFallEffect: 'fireworks' },
  'do-son': { openBurstEffect: 'fireworks', openFallEffect: 'lanterns' },
  'song-hy-do': { openBurstEffect: 'gold', openFallEffect: 'lanterns' },
  're-quat': { openBurstEffect: 'gold', openFallEffect: 'lanterns' },
  're-quat-sen': { openBurstEffect: 'bloom', openFallEffect: 'gold' },
  're-quat-ngoc': { openBurstEffect: 'butterflies', openFallEffect: 'petals' },
  're-quat-dem': { openBurstEffect: 'stars', openFallEffect: 'gold' },
  're-quat-bien': { openBurstEffect: 'petals', openFallEffect: 'none' },
  'vom-sen': { openBurstEffect: 'bloom', openFallEffect: 'gold' },
  'vom-ngoc': { openBurstEffect: 'butterflies', openFallEffect: 'petals' },
  'vom-dem': { openBurstEffect: 'stars', openFallEffect: 'gold' },
  'vom-bien': { openBurstEffect: 'petals', openFallEffect: 'none' },
  ...Object.fromEntries(WEDDING_MOON_CARDS.map((card) => [card.backgroundId, MOON_THEME_OPEN[card.paper]])),
  ...Object.fromEntries(WEDDING_LEAF_CARDS.map((card) => [card.backgroundId, MOON_THEME_OPEN[card.paper]])),
  'sen-vang': { openBurstEffect: 'bloom', openFallEffect: 'gold' },
  'hong-ngoc-trai': { openBurstEffect: 'butterflies', openFallEffect: 'petals' },
  'vuon-hong-troi': { openBurstEffect: 'butterflies', openFallEffect: 'stars' },
  'hoa-moc-xanh': { openBurstEffect: 'petals', openFallEffect: 'petals' },
  'to-duyen-xanh': { openBurstEffect: 'bloom', openFallEffect: 'none' },
  'tre-viet': { openBurstEffect: 'petals', openFallEffect: 'petals' },
  'hoa-dao': { openBurstEffect: 'bloom', openFallEffect: 'petals' },
  bien: { openBurstEffect: 'petals', openFallEffect: 'none' },
  'dem-vang': { openBurstEffect: 'stars', openFallEffect: 'gold' },
  'lua-ao-dai': { openBurstEffect: 'petals', openFallEffect: 'none' },
  'hoa-dao-van': { openBurstEffect: 'bloom', openFallEffect: 'petals' },
  'bien-van': { openBurstEffect: 'petals', openFallEffect: 'none' },
  'dem-vang-van': { openBurstEffect: 'stars', openFallEffect: 'gold' },
  'lua-van': { openBurstEffect: 'petals', openFallEffect: 'none' },
  'do-dam': { openBurstEffect: 'petals', openFallEffect: 'petals' },
  'phong-bi-thu': { openBurstEffect: 'petals', openFallEffect: 'petals' },
  'phong-bi-hong': { openBurstEffect: 'bloom', openFallEffect: 'petals' },
  'phong-bi-reu': { openBurstEffect: 'bloom', openFallEffect: 'none' },
  'phong-bi-dem': { openBurstEffect: 'stars', openFallEffect: 'gold' },
  'phong-bi-nga': { openBurstEffect: 'petals', openFallEffect: 'none' },
  'chua-mot-cot': { openBurstEffect: 'bloom', openFallEffect: 'petals' },
  'van-mieu': { openBurstEffect: 'petals', openFallEffect: 'petals' },
  'cho-ben-thanh': { openBurstEffect: 'bloom', openFallEffect: 'petals' },
  'vinh-ha-long': { openBurstEffect: 'petals', openFallEffect: 'none' },
  'lang-bac': { openBurstEffect: 'bloom', openFallEffect: 'petals' },
  'que-nghe-an': { openBurstEffect: 'petals', openFallEffect: 'petals' },
  'duong-lam': { openBurstEffect: 'petals', openFallEffect: 'none' },
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
  'kho-hong-baby': { openBurstEffect: 'bloom', openFallEffect: 'petals' },
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

/** Một khung của chủ đề. Bố cục hai khung chồng không còn. */
export function weddingHeroPhotoLayout(preset: Pick<WeddingBackgroundPreset, 'heroPhotoLayout'> | null | undefined): 'single' | 'stack' {
  void preset
  return 'single'
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
      textGlow: '',
      textGlowHeading: '',
      nav: 'border-[#e8c87a]/30 bg-[#4e1018]/92 text-[#f6e4b8] shadow-[0_4px_24px_rgba(0,0,0,0.28)]',
      ring: 'ring-[#e8c87a]/35',
    }
  }
  if (preset.look.surface !== 'dark' || !preset.look.paper) return next
  const night = preset.look.paper === NIGHT_PAPER
  return {
    ...next,
    darkPaper: preset.look.paper,
    pageBg: night ? 'bg-[#0c1830]' : 'bg-[#5c1018]',
    textGlow: GOLD_ON_RED_GLOW,
    textGlowHeading: GOLD_ON_RED_GLOW_HEADING,
    nav: night
      ? 'border-[#e6d3b3]/35 bg-[#0c1830]/92 text-[#f3e6c8] shadow-[0_4px_24px_rgba(0,0,0,0.35)]'
      : 'border-[#e8c87a]/30 bg-[#4a0c16]/92 text-[#f6e4b8] shadow-[0_4px_24px_rgba(0,0,0,0.28)]',
    ring: night ? 'ring-[#e6d3b3]/35' : 'ring-[#e8c87a]/35',
  }
}

/** Hoa văn sát mép chữ. Tấm kem 10% trong suốt, vẫn thấy nền xuyên qua. */
const SEE_THROUGH_TEXT_IDS = new Set([
  'chua-mot-cot',
  'van-mieu',
  'cho-ben-thanh',
  'vinh-ha-long',
  'lang-bac',
  'que-nghe-an',
  'duong-lam',
])

export function weddingTextUsesVeil(preset: WeddingBackgroundPreset | null | undefined): boolean {
  return Boolean(preset && SEE_THROUGH_TEXT_IDS.has(preset.id))
}

/** Mặt đọc phía sau chữ khi hoa văn nền cắt ngang nét chữ. Đỏ son và long phụng dùng tấm cùng màu giấy, trong suốt khoảng 10%. Giấy trơn và kho AI thì không phủ. */
export function weddingReadingPlate(
  preset: WeddingBackgroundPreset | null | undefined,
  pageBackground: string,
  themeIsDark: boolean,
): string | undefined {
  if (!pageBackground.trim()) return undefined
  if (preset?.look.contentCard === 'scallop') return undefined
  if (preset?.look === RED_LOOK || preset?.look === SCARLET_LOOK) return preset.look.textPlate
  if (preset?.look.surface === 'dark' && preset.look.paper) return preset.look.paper
  if (weddingTextUsesVeil(preset)) return preset?.look.textPlate
  // Kho AI và nền tự vẽ: không tấm chữ, hoa văn hiện suốt.
  if (!preset) return undefined
  if (preset.id.startsWith('ai-')) return themeIsDark ? '#0f172a' : '#fff8f2'
  return undefined
}

export function weddingKitSurface(preset: WeddingBackgroundPreset | null | undefined): {
  className: string
  style?: CSSProperties
} {
  if (!preset) return { className: '' }
  const sky = preset.id === 'vuon-hong-troi'
  return {
    className: sky ? `${preset.look.fontClass} wedding-kit-sky` : preset.look.fontClass,
    style: {
      '--wedding-text-plate': preset.look.textPlate,
      ...(sky ? { '--wedding-ink': preset.look.ink, '--wedding-muted': preset.look.muted } : {}),
    } as CSSProperties,
  }
}
