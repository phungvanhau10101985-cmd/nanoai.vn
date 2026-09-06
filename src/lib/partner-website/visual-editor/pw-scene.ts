import { PW_ENSURE_CONTENT_SCENE_ROOT_SOURCE } from './ensure-content-scene-root'
import {
  PW_DEVICE_FALLBACK_ORDER,
  PW_SCENE_WIDTH,
  pwCoordinateRuntimeSource,
  pwResolveCoordinateDevice,
  pwScaledFhdDesktopMediaQuery,
  pwSceneWidth,
  pwUniformSceneScale,
  type PwCoordinateDevice,
  type PwDeviceViewport,
} from './pw-coordinate-space'

export {
  PW_COORDINATE_CONTRACT_VERSION,
  PW_COORDINATE_VERSION_ATTR,
  PW_PLACEMENT_ATTR,
  PW_SCENE_WIDTH,
  pwClientBoxToScene,
  pwClientToScene,
  pwCoordinateDevice,
  pwCreateViewportMap,
  pwPickAvailableDevice,
  pwResolveCoordinateDevice,
  pwSceneBoxToClient,
  pwSceneToClient,
  pwSceneWidth,
  pwUniformSceneScale,
  type PwCoordinateDevice,
  type PwPlacementMode,
  type PwPoint,
  type PwSceneBox,
  type PwViewportMap,
} from './pw-coordinate-space'

/**
 * Lớp không gian toàn trang — mặt bằng chiếu từ trên xuống.
 *
 * Lớp 0 là nền. Các lớp trên trong suốt và phủ khít nền. Một phần tử thuộc lớp nào
 * là do `data-pw-scene`, không do vùng cha (header / banner / catalog / footer).
 * Nhờ vậy logo, ảnh trang trí, chữ rời… nằm chung một hệ lớp với cả trang.
 *
 * Không nhầm với:
 * - `pw-bg-stack.ts` — stack lớp NỀN (`data-pw-bg-index` / `data-pw-bg-role`).
 * - `data-pw-bg-layer` — hit-layer ảnh banner.
 * - `data-pw-layer` — chỉ số lớp nền đã thêm.
 *
 * Quan hệ với `data-pw-z` (thứ tự cũ, tính theo vùng cha):
 * z = index * PW_SCENE_BAND + local. Nên HTML cũ chỉ có `data-pw-z` vẫn suy ra được
 * lớp mà không cần migration.
 */

export const PW_SCENE_ATTR = 'data-pw-scene'
export const PW_SCENE_FOCUS_ATTR = 'data-pw-scene-focus'

/** Mỗi lớp chiếm một dải z riêng để lớp trên luôn phủ lớp dưới. */
export const PW_SCENE_BAND = 100
export const PW_SCENE_LOCAL_MAX = PW_SCENE_BAND - 1

export type PwSceneLayer = {
  index: number
  key: string
  z: number
  /** Lớp nền không nhận phần tử rời — chỉ là mặt đất của bản vẽ. */
  base: boolean
}

export const PW_SCENE_LAYERS: readonly PwSceneLayer[] = [
  { index: 0, key: 'nen', z: 0, base: true },
  { index: 1, key: 'duoi', z: 100, base: false },
  { index: 2, key: 'giua', z: 200, base: false },
  { index: 3, key: 'tren', z: 300, base: false },
  { index: 4, key: 'noi', z: 400, base: false },
]

export const PW_SCENE_MIN_INDEX = 0
export const PW_SCENE_MAX_INDEX = PW_SCENE_LAYERS.length - 1
export const PW_SCENE_Z_MAX = PW_SCENE_MAX_INDEX * PW_SCENE_BAND + PW_SCENE_LOCAL_MAX

/**
 * Head (topbar + header + nav) và thanh đáy — luôn trên mọi lớp canvas 0–4.
 * Lớp nổi giữa trang cao nhất là 499; head = 500. Thanh nổi kit vẫn 9999.
 * Không isolation trên header — chỉ nâng stacking context của cả khối chrome.
 */
export const PW_SCENE_HEAD_Z = PW_SCENE_Z_MAX + 1

/** Phần tử Thêm giữa trang mặc định lớp giữa (trên catalog, dưới head). */
export const PW_SCENE_DEFAULT_INDEX = 2

/**
 * Thanh cam (topbar) nằm trong stacking context của header.
 * Phải cao hơn lớp dưới (100) và thấp hơn logo mặc định (160) / lớp giữa (200)
 * — nếu để z=3 thì “Xuống lớp” vẫn để logo đè lên màu cam.
 */
export const PW_SCENE_TOPBAR_Z = 150

/** Logo header mặc định — trên topbar, dưới lớp giữa. */
export const PW_SCENE_LOGO_Z = 160

export function isPwSceneIndex(raw: unknown): boolean {
  // `Number('')` và `Number(null)` đều ra 0 — thuộc tính rỗng không được hiểu là lớp nền.
  if (typeof raw !== 'number' && typeof raw !== 'string') return false
  if (typeof raw === 'string' && raw.trim() === '') return false
  const n = Number(raw)
  return Number.isInteger(n) && n >= PW_SCENE_MIN_INDEX && n <= PW_SCENE_MAX_INDEX
}

export function clampPwSceneIndex(raw: unknown): number {
  const n = Math.round(Number(raw))
  if (!Number.isFinite(n)) return PW_SCENE_DEFAULT_INDEX
  return Math.min(PW_SCENE_MAX_INDEX, Math.max(PW_SCENE_MIN_INDEX, n))
}

export function pwSceneLayer(index: unknown): PwSceneLayer {
  return PW_SCENE_LAYERS[clampPwSceneIndex(index)]
}

/** Lớp suy ra từ z cũ — HTML chưa có `data-pw-scene` vẫn xếp đúng dải. */
export function pwSceneIndexOfZ(z: unknown): number {
  const n = Number(z)
  if (!Number.isFinite(n)) return PW_SCENE_DEFAULT_INDEX
  return clampPwSceneIndex(Math.floor(Math.max(0, n) / PW_SCENE_BAND))
}

/** Thứ tự trong cùng một lớp — giữ nguyên khi phần tử đổi lớp. */
export function pwSceneLocalOfZ(z: unknown): number {
  const n = Number(z)
  if (!Number.isFinite(n) || n <= 0) return 0
  const capped = Math.min(PW_SCENE_Z_MAX, Math.round(n))
  return Math.min(PW_SCENE_LOCAL_MAX, capped - pwSceneIndexOfZ(capped) * PW_SCENE_BAND)
}

export function pwSceneZ(index: unknown, local: unknown = 0): number {
  const localZ = Math.min(PW_SCENE_LOCAL_MAX, Math.max(0, Math.round(Number(local) || 0)))
  return clampPwSceneIndex(index) * PW_SCENE_BAND + localZ
}

/**
 * Icon tính năng / chrome widget trên Lớp giữa–nổi phải thắng nền thêm ở Lớp dưới.
 * Nền lớp dưới cố ý z=1… (stack nền), không dùng dải 100 — nên chrome phải tự mang z scene.
 */
export function pwSceneChromeZCss(): string {
  const sel = (index: number) =>
    `[data-pw-chrome-btn][data-pw-scene="${index}"],[data-pw-chrome-added][data-pw-scene="${index}"],[data-pw-el="cat-toggle"][data-pw-scene="${index}"],.pw-cat-btn[data-pw-scene="${index}"],.pw-shop-cat-btn[data-pw-scene="${index}"]`
  return [2, 3, 4]
    .map((index) => `${sel(index)}{z-index:${pwSceneZ(index)}!important}`)
    .join('')
}

/**
 * Z của **từng** phần tử đứng im lớp dưới — trên catalog (z 2), dưới head (`PW_SCENE_HEAD_Z`).
 * Không gắn số này lên cả tấm neo (cấm 210 / restack host).
 */
export const PW_STAY_HOIST_LAYER_Z = pwSceneZ(1)

/** Cả khối head (kể cả nav thấp nhất) và dock — trên lớp nổi giữa trang. */
export function pwSceneHeadStackCss(): string {
  return [
    `.pw-header,.pw-shop-header{z-index:${PW_SCENE_HEAD_Z}!important}`,
    `[data-pw-live-chrome]{z-index:${PW_SCENE_HEAD_Z}!important}`,
    `.pw-bottom-nav,.pw-shop-bottom-nav,[data-pw-live-dock]{z-index:${PW_SCENE_HEAD_Z}!important}`,
  ].join('')
}

/**
 * Một hệ lớp. Lớp 0 (nền) là chuẩn; mọi `data-pw-scene` dùng cùng dải z.
 * Nền thêm lớp dưới (không đứng im) giữ stack nền 1,2… — không nhảy dải 100.
 * Nền đứng im lớp dưới dùng `pwSceneStayScrollZCss` (100).
 * Head chrome (`PW_SCENE_HEAD_Z`) luôn trên lớp nổi giữa trang (4).
 */
export function pwSceneUnifiedStackCss(): string {
  return [
    `[data-pw-scene="0"]{z-index:${pwSceneZ(0)}!important}`,
    `[data-pw-scene="1"]:not([data-pw-added-bg]){z-index:${pwSceneZ(1)}!important}`,
    `[data-pw-scene="2"]:not([data-pw-region="banner"]):not([data-pw-region="categories"]):not([data-pw-region="catalog"]):not([data-pw-region="promo"]):not([data-pw-added-banner]):not([data-pw-added-catalog]){z-index:${pwSceneZ(2)}!important}`,
    `[data-pw-scene="3"]{z-index:${pwSceneZ(3)}!important}`,
    `[data-pw-scene="4"]{z-index:${pwSceneZ(4)}!important}`,
    pwSceneStayScrollZCss(),
    pwSceneChromeZCss(),
    pwSceneHeadStackCss(),
  ].join('')
}

/** Tấm neo chỉ nhóm DOM — không box, không z. `html` overflow-x phải visible. */
export function pwSceneHoistLayerHostCss(layerSel: string): string {
  const host = String(layerSel || '').trim()
  if (!host) return ''
  return `${host}{display:contents}`
}

/** Từng phần tử đứng im mang z scene — lớp dưới = 100, không z 1. */
export function pwSceneStayScrollZCss(): string {
  const stamped = [1, 2, 3, 4]
    .map((index) => `[data-pw-stay-scroll="1"][data-pw-scene="${index}"]{z-index:${pwSceneZ(index)}!important}`)
    .join('')
  const unstamped = `[data-pw-stay-scroll="1"][data-pw-added-bg="1"]:not([data-pw-scene]){z-index:${pwSceneZ(1)}!important}`
  return stamped + unstamped
}

/** Header / topbar / thanh đáy — chrome host; z head (`PW_SCENE_HEAD_Z`) thắng lớp nổi giữa trang. */
export const PW_SCENE_CHROME_STACK_HOST_SEL =
  'header, .pw-header, .pw-shop-header, .pw-topbar, .pw-shop-topbar, .pw-bottom-nav, .pw-shop-bottom-nav'

/**
 * Lớp neo `position:fixed` (đứng im / live-fixed) không được gắn z riêng.
 * Z theo `data-pw-scene` trên chính phần tử — nền lớp dưới/giữa không đè lớp nổi.
 */
export function pwSceneHoistLayerChildZCss(layerSel: string): string {
  const host = String(layerSel || '').trim()
  if (!host) return ''
  return [1, 2, 3, 4]
    .map((index) => `${host}>[data-pw-scene="${index}"]{z-index:${pwSceneZ(index)}!important}`)
    .join('')
}

/** Đọc lớp của phần tử: ưu tiên `data-pw-scene`, chưa có thì suy từ z. */
export function resolvePwSceneIndex(sceneAttr: unknown, z?: unknown): number {
  if (isPwSceneIndex(sceneAttr)) return Number(sceneAttr)
  const raw = String(sceneAttr ?? '').trim()
  if (raw !== '') {
    const byKey = PW_SCENE_LAYERS.find((layer) => layer.key === raw)
    if (byKey) return byKey.index
  }
  if (z == null || String(z).trim() === '') return PW_SCENE_DEFAULT_INDEX
  return pwSceneIndexOfZ(z)
}

/** Lớp thấp nhất phần tử rời được đặt (bỏ qua nền). */
export const PW_SCENE_ELEMENT_MIN_INDEX = 1

/** Lên/xuống một lớp, giữ nguyên thứ tự trong lớp. Trả về null khi đã ở biên. */
export function stepPwSceneZ(z: unknown, dir: number): number | null {
  const step = Number(dir) > 0 ? 1 : -1
  const from = pwSceneIndexOfZ(z)
  const to = from + step
  if (to < PW_SCENE_ELEMENT_MIN_INDEX || to > PW_SCENE_MAX_INDEX) return null
  return pwSceneZ(to, pwSceneLocalOfZ(z))
}

export function pwSceneLayerPos(index: unknown): 'bottom' | 'middle' | 'top' {
  const i = clampPwSceneIndex(index)
  if (i <= PW_SCENE_ELEMENT_MIN_INDEX) return 'bottom'
  if (i >= PW_SCENE_MAX_INDEX) return 'top'
  return 'middle'
}

/**
 * Khung toạ độ cố định của mỗi lớp, theo thiết bị.
 *
 * Toạ độ `x, y` của phần tử rời được đo trong khung này, rồi cả cảnh mới căn giữa
 * ở màn rộng hơn. Nhờ vậy đổi laptop ↔ desktop không làm phần tử nhảy — trùng đúng
 * bề rộng iframe của Sửa nhanh và dải `?pw-device=` công khai.
 */
export const PW_SCENE_DESIGN_WIDTH = PW_SCENE_WIDTH

/**
 * Khung vẽ căn giữa màn hình — cùng số với iframe Sửa nhanh / `?pw-device=`.
 * Desktop dùng 1440 (khung rộng) để đường tâm trùng trung điểm màn hình lớn.
 */
export const PW_SCENE_CANVAS_WIDTH = PW_SCENE_WIDTH

export type PwSceneDevice = PwCoordinateDevice

export function pwSceneDesignWidth(device: unknown): number {
  return pwSceneWidth(device)
}

export function pwSceneCanvasWidth(device: unknown): number {
  return pwSceneWidth(device)
}

/**
 * Chọn máy theo bề rộng cửa sổ, không theo CSS px sau khi Ctrl +/- zoom.
 * Gọi với `max(outerWidth, innerWidth)` để zoom không đổi laptop ↔ desktop.
 */
export function pwSceneLockFromWindowWidth(
  width: unknown,
  hint?: Pick<PwDeviceViewport, 'devicePixelRatio' | 'screenWidth'>
): PwSceneDevice {
  return pwResolveCoordinateDevice({
    outerWidth: width,
    layoutWidth: width,
    screenWidth: hint?.screenWidth,
    devicePixelRatio: hint?.devicePixelRatio,
  })
}

/** Khi shop chưa lưu bản laptop/tablet, khóa đúng máy đó sẽ ẩn hết và trang trắng. */
export const PW_SCENE_LOCK_FALLBACK = PW_DEVICE_FALLBACK_ORDER

export function pwSceneVisualWrapperSelector(device: PwSceneDevice): string {
  return `.pw-visual-${device},[data-pw-visual-device="${device}"]`
}

export function pwSceneHasVisualWrapper(
  doc: { querySelector: (selector: string) => unknown },
  device: PwSceneDevice
): boolean {
  return Boolean(doc.querySelector(pwSceneVisualWrapperSelector(device)))
}

/** `null` = HTML chưa có wrapper máy — đừng khóa, để CSS split tự hiện. */
export function pwSceneLockForAvailableHtml(
  preferred: PwSceneDevice,
  doc: { querySelector: (selector: string) => unknown }
): PwSceneDevice | null {
  const order = PW_SCENE_LOCK_FALLBACK[preferred] || PW_SCENE_LOCK_FALLBACK.desktop
  let any = false
  for (const device of order) {
    if (pwSceneHasVisualWrapper(doc, device)) {
      any = true
      break
    }
  }
  if (!any) return null
  for (const device of order) {
    if (pwSceneHasVisualWrapper(doc, device)) return device
  }
  return preferred
}

/** Trang chưa khóa máy — mới được phép ẩn widget theo độ rộng tab. */
export const PW_SCENE_UNLOCKED_HTML =
  'html:not([data-pw-edit-device]):not([data-pw-scene-lock])'

/** Máy compact = Sửa nhanh Mobile/Tablet. Live `?pw-device=` phải dùng cùng mặt này. */
export const PW_SCENE_COMPACT_HOSTS = [
  'html[data-pw-edit-device="mobile"]',
  'html[data-pw-edit-device="tablet"]',
  'html[data-pw-scene-lock="mobile"]',
  'html[data-pw-scene-lock="tablet"]',
] as const

export const PW_SCENE_PHONE_HOSTS = [
  'html[data-pw-edit-device="mobile"]',
  'html[data-pw-scene-lock="mobile"]',
] as const

export const PW_SCENE_TABLET_HOSTS = [
  'html[data-pw-edit-device="tablet"]',
  'html[data-pw-scene-lock="tablet"]',
] as const

export const PW_SCENE_WIDE_HOSTS = [
  'html[data-pw-edit-device="laptop"]',
  'html[data-pw-edit-device="desktop"]',
  'html[data-pw-scene-lock="laptop"]',
  'html[data-pw-scene-lock="desktop"]',
] as const

export const PW_SCENE_DESKTOP_HOSTS = [
  'html[data-pw-edit-device="desktop"]',
  'html[data-pw-scene-lock="desktop"]',
] as const

export const PW_SCENE_LAPTOP_HOSTS = [
  'html[data-pw-edit-device="laptop"]',
  'html[data-pw-scene-lock="laptop"]',
] as const

/** Gắn mỗi selector trong khối CSS (không có @media) vào từng host. */
export function pwHostPrefixCss(hosts: readonly string[], css: string): string {
  const chunks = String(css || '').match(/[^{}]+\{[^{}]*\}/g)
  if (!chunks?.length) return ''
  return chunks
    .map((chunk) => {
      const i = chunk.indexOf('{')
      const sel = chunk.slice(0, i).trim()
      const decls = chunk.slice(i)
      if (!sel) return ''
      return hosts
        .flatMap((host) => sel.split(',').map((part) => `${host} ${part.trim()}`))
        .join(',') + decls
    })
    .join('')
}

const PW_SCENE_DEVICES = ['mobile', 'tablet', 'laptop', 'desktop'] as const

const PW_CHROME_ADDED_NOT_SEARCH =
  '[data-pw-chrome-added]:not([data-pw-el="search"]):not(.pw-header-search):not(.pw-shop-search-wrap)'

/**
 * Widget Thêm theo máy: Sửa nhanh / `?pw-device=` / scene-lock thắng `@media` độ rộng tab.
 * Không khóa thì chrome-layout mới ẩn máy khác theo viewport.
 */
export function pwSceneChromeAddedVisibilityCss(): string {
  const show: string[] = []
  const hide: string[] = []
  for (const lock of PW_SCENE_DEVICES) {
    const sel = `${PW_CHROME_ADDED_NOT_SEARCH}[data-pw-device="${lock}"]`
    show.push(
      `html[data-pw-edit-device="${lock}"] ${sel}`,
      `html[data-pw-scene-lock="${lock}"] ${sel}`
    )
    for (const other of PW_SCENE_DEVICES) {
      if (other === lock) continue
      const otherSel = `${PW_CHROME_ADDED_NOT_SEARCH}[data-pw-device="${other}"]`
      hide.push(
        `html[data-pw-edit-device="${lock}"] ${otherSel}`,
        `html[data-pw-scene-lock="${lock}"] ${otherSel}`
      )
    }
  }
  return `${show.join(',')}{display:inline-flex!important}${hide.join(',')}{display:none!important}`
}

/** Ẩn bản máy khác chỉ khi bản đang khóa thật sự có trong HTML. */
export function pwSceneDeviceVisibilityCss(): string {
  const hide = (lock: PwSceneDevice, others: readonly PwSceneDevice[]) =>
    others
      .map(
        (device) =>
          `html[data-pw-scene-lock="${lock}"]:has(.pw-visual-${lock}) .pw-visual-${device}`
      )
      .join(',') + '{display:none!important}'
  const show = (lock: PwSceneDevice) =>
    `html[data-pw-scene-lock="${lock}"] .pw-visual-${lock}{display:contents!important}`
  return [
    hide('mobile', ['desktop', 'laptop', 'tablet']),
    show('mobile'),
    hide('tablet', ['desktop', 'laptop', 'mobile']),
    show('tablet'),
    hide('laptop', ['desktop', 'tablet', 'mobile']),
    show('laptop'),
    hide('desktop', ['laptop', 'tablet', 'mobile']),
    show('desktop'),
  ].join('')
}

export type PwSceneLiveZoomHint = {
  device?: string
  userAgent?: string
}

/** Phone / tablet UA — Chrome DevTools device mode spoofs this. */
export function pwLooksLikeMobileOrTabletUa(userAgent: unknown): boolean {
  const ua = String(userAgent || '')
  if (/ipad|tablet|kindle|silk/i.test(ua)) return true
  return /mobile|iphone|ipod|android/i.test(ua) && !/ipad/i.test(ua)
}

/**
 * Width used to scale the live canvas onto the visible CSS viewport.
 * Prefer `outerWidth` for desktop/laptop so Ctrl +/- / Windows Scale does not
 * switch machine, then cap to `innerWidth` so the painted canvas never
 * overflows the visible area (home / listing / PDP / cart / account / info).
 * Mobile/tablet (or phone UA / F12 device mode): use `innerWidth` so a wide
 * desktop chrome window does not scale a 390px scene down to a postage stamp.
 */
export function pwSceneLiveZoomViewWidth(
  innerWidth: unknown,
  outerWidth: unknown,
  screenWidth?: unknown,
  hint?: PwSceneLiveZoomHint
): number {
  const inner = Number(innerWidth)
  const outer = Number(outerWidth)
  const screen = Number(screenWidth)
  const device = String(hint?.device || '')
  const mobileish =
    device === 'mobile' || device === 'tablet' || pwLooksLikeMobileOrTabletUa(hint?.userAgent)
  if (mobileish && Number.isFinite(inner) && inner > 8) return inner
  let view = 0
  if (Number.isFinite(outer) && outer > 8) view = outer
  else if (Number.isFinite(inner) && inner > 8) view = inner
  else if (Number.isFinite(screen) && screen > 8) view = screen
  if (Number.isFinite(inner) && inner > 8 && view > inner) return inner
  return view
}

/**
 * Live copies the Sửa nhanh canvas 1:1 then scales it to the CSS viewport.
 * Device lock still uses `outerWidth`. Scale never exceeds `innerWidth / sceneW`
 * so 100% zoom on desktop/laptop does not clip left/right on any page.
 * `sceneW` omitted → 1 (Sửa nhanh iframe is already the canvas).
 */
export function pwSceneLiveZoomScale(
  innerWidth: unknown,
  outerWidth: unknown,
  screenWidth?: unknown,
  sceneW?: unknown,
  hint?: PwSceneLiveZoomHint
): number {
  const scene = Number(sceneW)
  if (!(scene > 8)) return 1
  const view = pwSceneLiveZoomViewWidth(innerWidth, outerWidth, screenWidth, hint)
  if (!(view > 8)) return 1
  return pwUniformSceneScale(view, scene)
}

/** Biến CSS dùng chung cho Sửa nhanh và trang khách — hai bên phải cùng số. */
export function pwSceneCssVars(device: unknown): string {
  return `--pw-scene-w:${pwSceneCanvasWidth(device)}px`
}

/** Ảnh banner luôn phủ kín khối — kéo = đổi crop, không dịch tấm ra khỏi khung. */
/** Hàng ngang Sửa nhanh — `+` trái/phải chèn mọi phần tử cạnh khối. */
export const PARTNER_SHOP_HROW_CSS = `
html [data-pw-hrow]{display:flex!important;flex-direction:row!important;align-items:stretch;width:var(--pw-block-w,100%);max-width:var(--pw-block-w,100%);margin-left:auto!important;margin-right:auto!important;box-sizing:border-box;gap:0}
html [data-pw-hrow]>*{flex:1 1 0;min-width:0;width:auto!important;max-width:100%!important;margin-left:0!important;margin-right:0!important;box-sizing:border-box}
html [data-pw-hrow]>[data-pw-added-bg="1"]:not([data-pw-added-bg-slot]){flex:0 0 auto!important;width:unset!important;max-width:none!important}
html [data-pw-hrow] [data-pw-region="banner"],html [data-pw-hrow] .pw-hero,html [data-pw-hrow] .pw-banner,html [data-pw-hrow] .pw-shop-hero,html [data-pw-hrow] .pw-shop-banner{width:auto!important;max-width:100%!important;margin-left:0!important;margin-right:0!important}
`.trim()

const STACK_FLOW_HOSTS = [
  '[data-pw-region="banner"]',
  '[data-pw-region="categories"]',
  '[data-pw-region="catalog"]',
  '[data-pw-region="promo"]',
  '[data-pw-added-banner]',
  '[data-pw-added-catalog]',
  '[data-pw-featured-categories]',
  '[data-pw-added-bg-slot]',
  '[data-pw-hrow]',
  '.pw-hero',
  '.pw-banner',
  '.pw-shop-hero',
  '.pw-shop-banner',
  '.pw-categories',
] as const

function stackFlowSel(extra = ''): string {
  return STACK_FLOW_HOSTS.map((sel) => `html ${sel}${extra}`).join(',')
}

const PW_PAGE_FIT_HOSTS = [
  'html:is([data-pw-edit-device="desktop"],[data-pw-edit-device="laptop"],[data-pw-scene-lock="desktop"],[data-pw-scene-lock="laptop"])',
  '[data-pw-visual-device="desktop"]',
  '[data-pw-visual-device="laptop"]',
] as const
const PW_PAGE_FIT_UNLOCKED = 'html:not([data-pw-edit-device]):not([data-pw-scene-lock])'
const PW_PAGE_FIT_FRAMES = [
  '[data-pw-region="banner"]',
  '[data-pw-region="categories"]',
  '[data-pw-region="catalog"]',
  '[data-pw-region="promo"]',
  '[data-pw-region="content"]',
  '[data-pw-region="form"]',
  '[data-pw-region="gallery"]',
  '[data-pw-region="pdp-info"]',
  '[data-pw-region="reviews"]',
  '[data-pw-region="cart-list"]',
  '[data-pw-region="cart-summary"]',
  '[data-pw-region="account-nav"]',
  '[data-pw-region="account-main"]',
  '.pw-shop-main',
  '.pw-shop-account-layout',
  '.pw-shop-account-content',
  '.pw-shop-info',
  '.pw-pdp',
  '.pw-shop-product-layout',
]
const PW_PAGE_FIT_CONTENT_IMGS = [
  '[data-pw-region="content"] img',
  '[data-pw-region="promo"] img',
  '[data-pw-region="form"] img',
  '[data-pw-info-body] img',
  '.pw-shop-info img',
  '.pw-shop-account-content img',
]

function pwPageFitJoin(prefixes: readonly string[], sels: readonly string[]): string {
  return prefixes.flatMap((prefix) => sels.map((sel) => `${prefix} ${sel}`)).join(',')
}

/** Desktop/laptop: khung giữa trang không rộng hơn canvas — mọi trang, không chỉ PDP. */
export const PARTNER_SHOP_PAGE_FIT_CSS = `
${pwPageFitJoin(PW_PAGE_FIT_HOSTS, PW_PAGE_FIT_FRAMES)}{max-width:100%;min-width:0;box-sizing:border-box}
${pwPageFitJoin(PW_PAGE_FIT_HOSTS, PW_PAGE_FIT_CONTENT_IMGS)}{max-width:100%;height:auto;box-sizing:border-box}
@media(min-width:1280px){${pwPageFitJoin([PW_PAGE_FIT_UNLOCKED], PW_PAGE_FIT_FRAMES)}{max-width:100%;min-width:0;box-sizing:border-box}${pwPageFitJoin([PW_PAGE_FIT_UNLOCKED], PW_PAGE_FIT_CONTENT_IMGS)}{max-width:100%;height:auto;box-sizing:border-box}}
`.trim()

/** Mảng khối + nền thêm in-flow chiếm chỗ, z dưới head (`PW_SCENE_HEAD_Z`) — kéo/cuộn không trèo head. */
export const PARTNER_SHOP_STACK_FLOW_CSS = `
${stackFlowSel()}{position:relative!important;left:auto!important;top:auto!important;right:auto!important;bottom:auto!important;float:none!important;z-index:1!important}
${stackFlowSel('[data-pw-scene]')}{z-index:1!important}
${stackFlowSel('[data-pw-placement="scene-absolute"]')}{position:relative!important;left:auto!important;top:auto!important;right:auto!important;bottom:auto!important;transform:none!important;z-index:1!important}
`.trim()

/** Thêm ở giữa: tách khối mới với phần trên/dưới một chút, không tạo khe lớn. */
export const PW_MID_INSERT_GAP_ATTR = 'data-pw-mid-gap'
export const PW_MID_INSERT_GAP_PX = 20

export const PARTNER_SHOP_MID_INSERT_GAP_CSS = `
html [${PW_MID_INSERT_GAP_ATTR}="1"]{margin-top:${PW_MID_INSERT_GAP_PX}px!important;margin-bottom:${PW_MID_INSERT_GAP_PX}px!important}
html [data-pw-hrow]>[${PW_MID_INSERT_GAP_ATTR}="1"]{margin-top:0!important;margin-bottom:0!important}
`.trim()

export const PARTNER_SHOP_BANNER_MEDIA_FILL_CSS = `
html [data-pw-region="banner"],html .pw-hero,html .pw-banner,html .pw-shop-hero,html .pw-shop-banner{overflow:hidden}
html [data-pw-added-banner]{
  background:linear-gradient(135deg,var(--pw-primary),var(--pw-accent));color:#fff
}
html [data-pw-added-banner]::before,html [data-pw-added-banner]::after{display:none!important;content:none!important;background:none!important}
html [data-pw-added-banner] img[data-pw-banner-placeholder="1"]{opacity:0!important}
html [data-pw-region="banner"] img[data-pw-el="media"],
html [data-pw-region="banner"] img[data-pw-banner-zoom],
html .pw-hero img[data-pw-el="media"],html .pw-banner img[data-pw-el="media"],
html .pw-shop-hero img[data-pw-el="media"],html .pw-shop-banner img[data-pw-el="media"]{
  position:absolute!important;inset:0!important;left:0!important;top:0!important;right:0!important;bottom:0!important;
  width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;
  object-fit:cover!important;box-sizing:border-box;z-index:0
}
html [data-pw-banner-wash="1"]{position:absolute;inset:0;pointer-events:none;z-index:1}
html [data-pw-region="banner"] [data-pw-el="inner"],html .pw-hero-inner,html .pw-banner-inner{position:relative;z-index:2}
`.trim()

/**
 * Sửa nhanh is the source. Live must not restyle banner from the tab width.
 * Saved HTML still embeds `@media (max-width:899px) .pw-hero` card + `.pw-btn-hero` uppercase.
 */
export const PARTNER_SHOP_BANNER_LIVE_MATCH_CSS = `
html [data-pw-region="banner"] [data-pw-el="cta"],
html [data-pw-region="banner"] [data-pw-el="cta-secondary"],
html .pw-hero [data-pw-el="cta"],html .pw-hero [data-pw-el="cta-secondary"],
html .pw-banner [data-pw-el="cta"],html .pw-banner [data-pw-el="cta-secondary"],
html .pw-shop-hero [data-pw-el="cta"],html .pw-shop-hero [data-pw-el="cta-secondary"]{
  text-transform:none!important;
  width:auto!important;
  max-width:100%;
  display:inline-flex!important;
  flex:0 0 auto!important;
  box-sizing:border-box
}
html [data-pw-region="banner"] [data-pw-el="copy"] > div:has(> [data-pw-el="cta"]),
html .pw-hero-copy > div:has(> [data-pw-el="cta"]),
html .pw-banner-copy > div:has(> [data-pw-el="cta"]){
  display:flex!important;
  flex-direction:row!important;
  flex-wrap:wrap!important;
  align-items:center!important
}
html [data-pw-region="banner"] [data-pw-el="cta"][data-pw-chrome-label],
html [data-pw-region="banner"] [data-pw-el="cta-secondary"][data-pw-chrome-label]{
  font-size:var(--pw-chrome-label)!important
}
@media (max-width:899px){
${pwHostPrefixCss(
  PW_SCENE_WIDE_HOSTS,
  `
.pw-hero,.pw-banner,.pw-shop-hero,.pw-shop-banner,[data-pw-region="banner"]{margin-top:0!important}
.pw-hero:not([data-pw-image-radius]),.pw-banner:not([data-pw-image-radius]),.pw-shop-hero:not([data-pw-image-radius]),.pw-shop-banner:not([data-pw-image-radius]),[data-pw-region="banner"]:not([data-pw-image-radius]),.pw-hero[data-pw-image-radius="0"],.pw-banner[data-pw-image-radius="0"],.pw-shop-hero[data-pw-image-radius="0"],.pw-shop-banner[data-pw-image-radius="0"],[data-pw-region="banner"][data-pw-image-radius="0"]{border-radius:0!important}
.pw-btn-hero{border:none!important}
`
)}
}
`.trim()

/** Sửa nhanh chiều cao / bo góc khối — live đọc attr, không để CSS mẫu kéo về 360px / radius 0. */
export const PARTNER_SHOP_AUTHORED_BLOCK_CSS = `
html [data-pw-image-radius]{
  border-radius:var(--pw-image-radius,0px)!important;
  overflow:hidden!important
}
html [data-pw-region="banner"][data-pw-image-radius] img,
html .pw-hero[data-pw-image-radius] img,
html .pw-banner[data-pw-image-radius] img,
html .pw-shop-hero[data-pw-image-radius] img,
html .pw-shop-banner[data-pw-image-radius] img,
html [data-pw-added-banner][data-pw-image-radius] img{
  border-radius:inherit
}
html [data-pw-block-h]:not([data-pw-added-bg]):not([data-pw-added-catalog]):not([data-pw-featured-categories]):not([data-pw-region="catalog"]){
  min-height:var(--pw-block-h)!important;
  height:var(--pw-block-h)!important
}
`.trim()

export const PW_SCENE_MEDIA_ZOOM_SEL = [
  '[data-pw-region="banner"] img[data-pw-el="media"]',
  '[data-pw-region="banner"] img[data-pw-edit*="hero"]',
  '[data-pw-region="banner"] img[data-pw-edit*="banner"]',
  '[data-pw-region="promo"] img[data-pw-el="media"]',
  '[data-pw-region="content"] img[data-pw-el="media"]',
  '[data-pw-region="content"] img[data-pw-el="image"]',
  '.pw-hero img:not(.pw-logo):not(.pw-shop-logo):not(.pw-chrome-chat-logo)',
  '.pw-banner img:not(.pw-logo):not(.pw-shop-logo)',
  '.pw-shop-hero img:not(.pw-shop-logo)',
  '.pw-shop-banner img:not(.pw-shop-logo)',
  '[data-pw-bg-layer="1"] img',
  'img[data-pw-banner-zoom]',
].join(',')

export const PW_LIVE_CHROME_ATTR = 'data-pw-live-chrome'
export const PW_LIVE_CHROME_SCALE_ATTR = 'data-pw-live-chrome-scale'
export const PW_LIVE_CHROME_PH_ATTR = 'data-pw-live-chrome-ph'
export const PW_LIVE_DOCK_ATTR = 'data-pw-live-dock'

/**
 * Live inline: sticky header không được nằm trong ancestor có transform.
 * Host sticky + mặt header full viewport, không `transform:scale` — vùng bấm = vùng vẽ
 * (canvas vẫn scale qua `[data-pw-inline-visual-root]`).
 * Thanh đáy / PDP sticky hoist ra [data-pw-live-dock] (fixed đáy viewport, không transform).
 * Thanh nổi kit hoist ra [data-pw-live-fixed-layer] để `position:fixed` không dính canvas scale.
 */
export function pwSceneLiveChromeCss(): string {
  return [
    `[${PW_LIVE_CHROME_ATTR}]{position:sticky!important;top:0!important;z-index:${PW_SCENE_HEAD_Z}!important;width:100%;display:flex;flex-direction:column;align-items:stretch;box-sizing:border-box}`,
    `[${PW_LIVE_CHROME_SCALE_ATTR}]{width:100%!important;max-width:100%!important;transform:none!important;display:flex;flex-direction:column;flex:0 0 auto;box-sizing:border-box}`,
    `[${PW_LIVE_CHROME_ATTR}] .pw-header,[${PW_LIVE_CHROME_ATTR}] .pw-shop-header{position:relative!important;top:auto!important;width:100%!important}`,
    // Sticky chrome already occupies page flow. Do not leave an in-canvas
    // header spacer — scene Y is measured from `main`, not the visual root.
    `[${PW_LIVE_CHROME_PH_ATTR}]{display:none!important;height:0!important;min-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important;pointer-events:none}`,
    `html[data-pw-scene-zoomed="1"] [data-pw-inline-visual-root] .pw-header,html[data-pw-scene-zoomed="1"] [data-pw-inline-visual-root] .pw-shop-header{position:relative!important;top:auto!important}`,
    pwSceneLiveDockCss(),
  ].join('')
}

/** Thanh đáy live: host fixed viewport, không nằm trong canvas `transform:scale`. */
export function pwSceneLiveDockCss(): string {
  return [
    `[${PW_LIVE_DOCK_ATTR}]{position:fixed!important;left:0!important;right:0!important;bottom:0!important;top:auto!important;z-index:${PW_SCENE_HEAD_Z}!important;width:100%;max-width:100%;display:flex;flex-direction:column;align-items:stretch;box-sizing:border-box;pointer-events:none;transform:none!important}`,
    `html[data-pw-scene-lock="mobile"] [${PW_LIVE_DOCK_ATTR}]>.pw-bottom-nav,html[data-pw-scene-lock="mobile"] [${PW_LIVE_DOCK_ATTR}]>.pw-shop-bottom-nav,html[data-pw-scene-lock="tablet"] [${PW_LIVE_DOCK_ATTR}]>.pw-bottom-nav,html[data-pw-scene-lock="tablet"] [${PW_LIVE_DOCK_ATTR}]>.pw-shop-bottom-nav,html[data-pw-edit-device="mobile"] [${PW_LIVE_DOCK_ATTR}]>.pw-bottom-nav,html[data-pw-edit-device="mobile"] [${PW_LIVE_DOCK_ATTR}]>.pw-shop-bottom-nav,html[data-pw-edit-device="tablet"] [${PW_LIVE_DOCK_ATTR}]>.pw-bottom-nav,html[data-pw-edit-device="tablet"] [${PW_LIVE_DOCK_ATTR}]>.pw-shop-bottom-nav,[${PW_LIVE_DOCK_ATTR}]>.pw-bottom-nav,[${PW_LIVE_DOCK_ATTR}]>.pw-shop-bottom-nav,[${PW_LIVE_DOCK_ATTR}]>.pw-pdp-sticky,[${PW_LIVE_DOCK_ATTR}]>[data-pw-pdp-bottom]{position:relative!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;width:100%!important;max-width:100%!important;transform:none!important;pointer-events:auto}`,
    `[${PW_LIVE_DOCK_ATTR}] .pw-bottom-nav>a,[${PW_LIVE_DOCK_ATTR}] .pw-shop-bottom-nav>a,[${PW_LIVE_DOCK_ATTR}] .pw-bottom-nav>button,[${PW_LIVE_DOCK_ATTR}] .pw-shop-bottom-nav>button,[${PW_LIVE_DOCK_ATTR}] .pw-pdp-sticky-nav a,[${PW_LIVE_DOCK_ATTR}] .pw-pdp-sticky-nav button{position:relative!important;left:auto!important;top:auto!important;right:auto!important;bottom:auto!important;transform:none!important}`,
  ].join('')
}

/** Đường tâm mọi máy = trung điểm màn hình. Inject vào chrome layout dùng chung. */
export function pwSceneCenterCss(): string {
  const m = PW_SCENE_CANVAS_WIDTH.mobile
  const t = PW_SCENE_CANVAS_WIDTH.tablet
  const l = PW_SCENE_CANVAS_WIDTH.laptop
  const d = PW_SCENE_CANVAS_WIDTH.desktop
  return [
    `html{--pw-scene-w:${d}px;--pw-scene-zoom:1}`,
    `html[data-pw-edit-device="mobile"],html[data-pw-scene-lock="mobile"]{--pw-scene-w:${m}px}`,
    `html[data-pw-edit-device="tablet"],html[data-pw-scene-lock="tablet"]{--pw-scene-w:${t}px}`,
    `html[data-pw-edit-device="laptop"],html[data-pw-scene-lock="laptop"]{--pw-scene-w:${l}px}`,
    `html[data-pw-edit-device="desktop"],html[data-pw-scene-lock="desktop"]{--pw-scene-w:${d}px}`,
    `@media (max-width:${t - 1}px){html:not([data-pw-edit-device]):not([data-pw-scene-lock]){--pw-scene-w:${m}px}}`,
    `@media (min-width:${t}px) and (max-width:${l - 1}px){html:not([data-pw-edit-device]):not([data-pw-scene-lock]){--pw-scene-w:${t}px}}`,
    `@media (min-width:${l}px) and (max-width:${d - 1}px){html:not([data-pw-edit-device]):not([data-pw-scene-lock]){--pw-scene-w:${l}px}}`,
    `@media ${pwScaledFhdDesktopMediaQuery()}{html:not([data-pw-edit-device]):not([data-pw-scene-lock]){--pw-scene-w:${d}px}}`,
    `@media (min-width:${d}px){html:not([data-pw-edit-device]):not([data-pw-scene-lock]){--pw-scene-w:${d}px}}`,
    // Sửa nhanh: body trong iframe đúng khổ máy. Live: cùng khổ rồi scale phủ viewport.
    // `transform:scale` (kể cả scale(1)) tạo containing block → sticky header “nặn xuống”.
    // Chỉ scale khi zoom thật; header hoist ra [data-pw-live-chrome] (sticky, không transform trên host).
    `html[data-pw-edit-device] body.nanoai-ve-active{width:var(--pw-scene-w)!important;min-width:var(--pw-scene-w)!important;max-width:none!important;margin-left:calc(50% - (var(--pw-scene-w) / 2))!important;margin-right:auto!important;box-sizing:border-box;overflow-x:visible;transform-origin:top center;display:block}`,
    `[data-pw-inline-visual-root]{width:var(--pw-scene-w)!important;min-width:var(--pw-scene-w)!important;max-width:none!important;min-height:0!important;height:auto!important;margin-left:calc(50% - (var(--pw-scene-w) / 2))!important;margin-right:auto!important;box-sizing:border-box;overflow-x:visible;transform-origin:top center;transform:none;display:block}`,
    `[data-pw-scene-root="1"]{position:relative;box-sizing:border-box;width:100%;max-width:none;transform-origin:top center}`,
    `[data-pw-placement="scene-absolute"]{position:absolute!important;right:auto!important;bottom:auto!important;margin:0!important;transform:none!important}`,
    `[data-pw-placement="viewport-fixed"]{position:fixed!important;right:auto;bottom:auto;margin:0!important;transform:none!important}`,
    `html[data-pw-scene-zoomed="1"] [data-pw-inline-visual-root]{transform:scale(var(--pw-scene-zoom,1))}`,
    pwSceneLiveChromeCss(),
    pwSceneHoistLayerHostCss('[data-pw-live-fixed-layer]'),
    `[data-pw-live-fixed-layer]>*{pointer-events:auto}`,
    `[data-pw-live-fixed-layer]>[data-pw-added-bg="1"]{pointer-events:none!important}`,
    `[data-pw-live-fixed-layer]>[data-pw-added-bg="1"] a,[data-pw-live-fixed-layer]>[data-pw-added-bg="1"] button,[data-pw-live-fixed-layer]>[data-pw-added-bg="1"] [data-pw-chrome-btn],[data-pw-live-fixed-layer]>[data-pw-added-bg="1"] [data-pw-el]{pointer-events:auto!important}`,
    pwSceneHoistLayerChildZCss('[data-pw-live-fixed-layer]'),
    `main:has([data-pw-inline-visual-root]){width:100%!important;max-width:none!important;margin:0!important;padding:0!important;display:block!important}`,
    `${PW_SCENE_MEDIA_ZOOM_SEL}{transform-origin:50% var(--pw-zoom-oy,50%)}`,
  ].join('')
}

/**
 * Gốc zoom Y = điểm giữa đứng của màn hình máy, tính trên phần tử.
 * Trả về % theo chiều cao phần tử (có thể ngoài 0–100 khi ảnh không cắt đường giữa).
 */
export function pwMediaZoomOriginYPct(top: number, height: number, viewHeight: number): number {
  if (!(height > 0) || !(viewHeight > 0)) return 50
  return ((viewHeight / 2 - top) / height) * 100
}

/** Runtime Sửa nhanh + web thật: neo canvas theo trung điểm màn hình. */
export const PARTNER_SHOP_SCENE_CENTER_SCRIPT_ID = 'pw-shop-scene-center'
/** Khóa máy theo outerWidth (không đổi khi Ctrl +/-); scale khít innerWidth — không tràn viewport. */
export const PARTNER_SHOP_SCENE_CENTER_SCRIPT = `${pwCoordinateRuntimeSource()}
(function(){
  var C=window.__pwCoordinate;
  var W=C.widths;
  ${PW_ENSURE_CONTENT_SCENE_ROOT_SOURCE}
  function uaDevice(){
    var ua=navigator.userAgent||'';
    var touch=0;
    try{touch=Number(navigator.maxTouchPoints||0)}catch(eT){}
    if(/ipad|tablet|kindle|silk/i.test(ua))return'tablet';
    if(/iphone|ipod/i.test(ua))return'mobile';
    if(/android/i.test(ua))return /mobile/i.test(ua)?'mobile':'tablet';
    if(/mobile/i.test(ua))return'mobile';
    if(touch>1&&/macintosh/i.test(ua))return'tablet';
    return '';
  }
  function queryDevice(){
    try{
      var q=new URLSearchParams(window.location.search).get('pw-device');
      if(q==='mobile'||q==='tablet'||q==='laptop'||q==='desktop')return q;
    }catch(eQ){}
    return '';
  }
  function stamped(){
    var html=document.documentElement;
    return html&&html.getAttribute?String(html.getAttribute('data-pw-edit-device')||''):'';
  }
  function band(){
    var s=queryDevice()||stamped()||uaDevice();
    return C.resolveDevice({
      forcedDevice:s,
      outerWidth:(s==='mobile'||s==='tablet')?(window.innerWidth||0):(window.outerWidth||0),
      layoutWidth:window.innerWidth||(document.documentElement&&document.documentElement.clientWidth)||0,
      screenWidth:window.screen&&Math.max(window.screen.width||0,window.screen.availWidth||0)||0,
      devicePixelRatio:window.devicePixelRatio||0
    });
  }
  function liveRoot(){
    return document.querySelector('[data-pw-inline-visual-root]');
  }
  function zoomScale(scenePx,key){
    var root=liveRoot();
    if(!root)return 1;
    var inner=window.innerWidth||(document.documentElement&&document.documentElement.clientWidth)||0;
    var outer=window.outerWidth||0;
    var screenW=window.screen&&(window.screen.availWidth||window.screen.width)||0;
    var ua=navigator.userAgent||'';
    var mobileish=key==='mobile'||key==='tablet'||(/ipad|tablet|kindle|silk/i.test(ua))||(/mobile|iphone|ipod|android/i.test(ua)&&!/ipad/i.test(ua));
    var view=mobileish&&inner>8?inner:(outer>8?outer:(inner>8?inner:screenW));
    if(inner>8&&view>inner)view=inner;
    if(!(view>8)||!(scenePx>8))return 1;
    return C.createMap({device:key,viewportWidth:view}).scale;
  }
  function hasWrap(k){
    return document.querySelector('.pw-visual-'+k+',[data-pw-visual-device="'+k+'"]');
  }
  function pick(preferred){
    return C.pickAvailable(preferred,function(k){return !!hasWrap(k)});
  }
  function parsePx(v){
    var n=parseFloat(String(v==null?'':v));
    return isFinite(n)?n:NaN;
  }
  function isChromeFloat(el){
    var k=el&&el.getAttribute?String(el.getAttribute('data-pw-chrome-btn')||''):'';
    return k==='chat'||k==='chat-zalo'||k==='chat-facebook'||k==='chat-instagram'||k==='chat-whatsapp'||k==='topup';
  }
  function isAuthoredOverlay(el){
    if(!el||!el.getAttribute)return false;
    if(el.getAttribute('data-pw-chrome-added')==='1'&&el.getAttribute('data-pw-chrome-btn')&&el.getAttribute('data-pw-chrome-kit')!=='1')return true;
    if(el.getAttribute('data-pw-added-bg')==='1'&&el.getAttribute('data-pw-added-bg-slot')!=='1')return true;
    return el.getAttribute('data-pw-added-text')==='1'||el.getAttribute('data-pw-added-btn')==='1'||el.getAttribute('data-pw-added-image')==='1'||el.getAttribute('data-pw-added-video')==='1';
  }
  function isInFlowSlot(el){
    if(!el||!el.getAttribute)return false;
    return el.getAttribute('data-pw-added-bg-slot')==='1'||el.getAttribute('data-pw-added-catalog')==='1'||el.getAttribute('data-pw-added-banner')==='1'||el.hasAttribute('data-pw-hrow');
  }
  function isInFlowCatalogChrome(el){
    if(!el||!el.getAttribute||isAuthoredOverlay(el))return false;
    if(isInFlowSlot(el))return true;
    var region=el.getAttribute('data-pw-region')||'';
    if(region==='banner'||region==='categories'||region==='catalog'||region==='promo')return true;
    var role=el.getAttribute('data-pw-el')||'';
    if(role==='section-title'||role==='section-more')return true;
    if(el.getAttribute('data-pw-catalog')!=null||el.getAttribute('data-pw-grid')!=null)return true;
    var cls=String(el.className||'');
    if(cls.indexOf('pw-section-title')>=0||cls.indexOf('pw-section-more')>=0)return true;
    if(/(?:^|\\s)(?:pw-hero|pw-banner|pw-shop-hero|pw-shop-banner|pw-categories)(?:\\s|$)/.test(cls))return true;
    return !!(el.closest&&el.closest('[data-pw-region="catalog"],[data-pw-catalog]'));
  }
  function isInFlowStackHost(el){
    if(!el||!el.getAttribute||isAuthoredOverlay(el))return false;
    if(isInFlowSlot(el))return true;
    var region=el.getAttribute('data-pw-region')||'';
    if(region==='banner'||region==='categories'||region==='catalog'||region==='promo')return true;
    var cls=String(el.className||'');
    return /(?:^|\\s)(?:pw-hero|pw-banner|pw-shop-hero|pw-shop-banner|pw-categories)(?:\\s|$)/.test(cls);
  }
  function reflowInFlowStackHosts(root){
    if(!root||!root.querySelectorAll)return;
    var nodes=root.querySelectorAll('[data-pw-region="banner"],[data-pw-region="categories"],[data-pw-region="catalog"],[data-pw-region="promo"],[data-pw-added-banner],[data-pw-added-catalog],[data-pw-added-bg-slot],[data-pw-hrow],.pw-hero,.pw-banner,.pw-shop-hero,.pw-shop-banner,.pw-categories');
    var i;
    for(i=0;i<nodes.length;i++){
      var el=nodes[i];
      if(!el||!el.getAttribute||isAuthoredOverlay(el))continue;
      try{el.removeAttribute('data-pw-placement')}catch(eP){}
      try{el.removeAttribute('data-pw-user-move')}catch(eM){}
      try{el.removeAttribute('data-pw-z')}catch(eZ){}
      if(!el.style)continue;
      el.style.removeProperty('position');
      el.style.removeProperty('left');
      el.style.removeProperty('top');
      el.style.removeProperty('right');
      el.style.removeProperty('bottom');
      el.style.removeProperty('transform');
      el.style.removeProperty('z-index');
    }
  }
  function sceneCanvasOf(root){
    if(!root||!root.querySelector)return root;
    var stamped=root.querySelector('[data-pw-scene-root="1"]');
    if(stamped&&stamped!==root&&!isBodyOrVisualHost(stamped)&&!isOuterSceneChromeNode(stamped))return stamped;
    var main=root.querySelector('main,.pw-shop-main,.pw-main');
    return main||root;
  }
  function staysInCatalogRow(el,sceneRoot){
    if(!el||!el.closest)return false;
    if(sceneRoot&&el.parentNode===sceneRoot)return false;
    if(el.closest('[data-pw-hrow]'))return true;
    return !!(el.closest('[data-pw-region="catalog"],[data-pw-catalog],[data-pw-region="banner"],[data-pw-region="categories"],[data-pw-added-banner],[data-pw-added-catalog],[data-pw-added-bg-slot]'));
  }
  function isPct(raw){
    return String(raw||'').indexOf('%')>=0;
  }
  function readCanvasBox(el,scenePx,scale){
    var placement=el.getAttribute('data-pw-placement')||'';
    if(placement==='viewport-fixed'){
      var fx=parsePx(el.getAttribute('data-pw-fixed-x'));
      var fy=parsePx(el.getAttribute('data-pw-fixed-y'));
      var norm=C.looksNorm(fx,fy);
      return {
        x:fx,
        y:fy,
        w:parsePx(el.getAttribute('data-pw-fixed-w')),
        h:parsePx(el.getAttribute('data-pw-fixed-h')),
        xu:norm?'norm':'px',
        yu:norm?'norm':'px'
      };
    }
    if(placement==='scene-absolute'){
      return {
        x:parsePx(el.getAttribute('data-pw-box-x')),
        y:parsePx(el.getAttribute('data-pw-box-y')),
        w:parsePx(el.getAttribute('data-pw-box-w')),
        h:parsePx(el.getAttribute('data-pw-box-h')),
        xu:'px',
        yu:'px'
      };
    }
    if(el.getAttribute('data-pw-canvas-x')!=null&&el.getAttribute('data-pw-canvas-x')!==''){
      return {
        x:parsePx(el.getAttribute('data-pw-canvas-x')),
        y:parsePx(el.getAttribute('data-pw-canvas-y')),
        w:parsePx(el.getAttribute('data-pw-canvas-w')),
        h:parsePx(el.getAttribute('data-pw-canvas-h')),
        xu:el.getAttribute('data-pw-canvas-xu')||'px',
        yu:el.getAttribute('data-pw-canvas-yu')||'px'
      };
    }
    var st=el.style||{};
    var left=parsePx(st.left);
    var top=parsePx(st.top);
    var xu=isPct(st.left)?'pct':'px';
    var yu=isPct(st.top)?'pct':'px';
    var w=parsePx(st.width);
    var h=parsePx(st.height);
    if(!isFinite(left)&&st.inset){
      var parts=String(st.inset).trim().split(/\\s+/);
      if(parts.length===4){top=parsePx(parts[0]);left=parsePx(parts[3]);xu='px';yu='px';}
    }
    var sx=parsePx(el.getAttribute('data-pw-stay-x'));
    var sy=parsePx(el.getAttribute('data-pw-stay-y'));
    var sw=parsePx(el.getAttribute('data-pw-stay-w'));
    var sh=parsePx(el.getAttribute('data-pw-stay-h'));
    if(!isFinite(left)&&isFinite(sx)){left=sx;xu='pct';}
    if(!isFinite(top)&&isFinite(sy)){top=sy;yu='pct';}
    if(isFinite(sw)&&!isFinite(w))w=sw;
    if(isFinite(sh)&&!isFinite(h))h=sh;
    if(!isFinite(w)||!isFinite(h)){
      try{
        var r=el.getBoundingClientRect();
        var z=scale>0?scale:1;
        if(!isFinite(w)&&r.width>0)w=r.width/z;
        if(!isFinite(h)&&r.height>0)h=r.height/z;
      }catch(eR){}
    }
    if(isFinite(left))el.setAttribute('data-pw-canvas-x',String(left));
    if(isFinite(top))el.setAttribute('data-pw-canvas-y',String(top));
    if(isFinite(w))el.setAttribute('data-pw-canvas-w',String(w));
    if(isFinite(h))el.setAttribute('data-pw-canvas-h',String(h));
    el.setAttribute('data-pw-canvas-xu',xu);
    el.setAttribute('data-pw-canvas-yu',yu);
    return {x:left,y:top,w:w,h:h,xu:xu,yu:yu};
  }
  function shouldBindFixed(el){
    if(!el||!el.getAttribute||isChromeFloat(el))return false;
    if(el.closest&&el.closest('header,.pw-header,.pw-shop-header,[data-pw-live-chrome],[data-pw-live-dock],[data-pw-chrome-kit="float"],[data-pw-chrome-float-host="1"],.pw-bottom-nav,.pw-shop-bottom-nav,.pw-pdp-actions,.pw-pdp-sticky,[data-pw-pdp-bottom]'))return false;
    if(isInFlowCatalogChrome(el))return false;
    if(el.getAttribute('data-pw-placement')==='scene-absolute')return false;
    if(el.getAttribute('data-pw-box-x')&&el.getAttribute('data-pw-placement')!=='viewport-fixed')return false;
    if(el.getAttribute('data-pw-placement')==='viewport-fixed')return true;
    if(el.getAttribute('data-pw-stay-scroll')==='1')return false;
    if(el.getAttribute('data-pw-pin-screen')==='1')return true;
    var pos='';
    try{pos=window.getComputedStyle(el).position}catch(eP){}
    if(pos!=='fixed')return false;
    return el.getAttribute('data-pw-user-move')==='1'||el.getAttribute('data-pw-added-bg')==='1'||el.getAttribute('data-pw-chrome-added')==='1';
  }
  function isEditor(){
    return !!(document.body&&document.body.classList.contains('nanoai-ve-active'));
  }
  function findLiveHeader(root){
    if(!root||!root.querySelectorAll)return null;
    var list=root.querySelectorAll('header.pw-header,header.pw-shop-header,.pw-header,.pw-shop-header');
    var outside=null,inside=null,i;
    for(i=0;i<list.length;i++){
      var el=list[i];
      if(el.closest&&el.closest('[data-pw-live-chrome]')){ if(!inside) inside=el; }
      else if(!outside) outside=el;
    }
    return outside||inside;
  }
  function siblingChrome(host){
    if(!host||!host.children)return null;
    var i;
    for(i=0;i<host.children.length;i++){
      var n=host.children[i];
      if(n.getAttribute&&n.getAttribute('data-pw-live-chrome')==='1')return n;
    }
    return null;
  }
  function runtimeRevision(root){
    return root&&root.getAttribute?String(root.getAttribute('data-pw-runtime-revision')||''):'';
  }
  function currentRuntimeHost(node,root){
    if(!node)return null;
    var revision=runtimeRevision(root);
    if(revision&&node.getAttribute('data-pw-runtime-revision')!==revision){
      try{node.remove()}catch(eR){}
      return null;
    }
    if(revision)node.setAttribute('data-pw-runtime-revision',revision);
    return node;
  }
  function hoistLiveChrome(root,scale){
    if(!root||isEditor())return;
    var header=findLiveHeader(root);
    var host=root.parentNode||document.body;
    if(!host)return;
    var chrome=currentRuntimeHost(siblingChrome(host),root);
    var leftover=root.querySelectorAll('[data-pw-live-chrome-ph]');
    var li;
    for(li=0;li<leftover.length;li++){
      try{leftover[li].remove()}catch(ePh){}
    }
    if(!header){
      if(!chrome)return;
      var inner0=chrome.querySelector('[data-pw-live-chrome-scale]')||chrome;
      if(inner0.style)inner0.style.removeProperty('margin-bottom');
      return;
    }
    var nodes=[];
    var prev=header.previousElementSibling;
    if(prev&&prev.matches&&prev.matches('.pw-topbar,.pw-shop-topbar,[data-pw-region="topbar"]'))nodes.push(prev);
    nodes.push(header);
    if(!chrome){
      chrome=document.createElement('div');
      chrome.setAttribute('data-pw-live-chrome','1');
      var chromeRevision=runtimeRevision(root);
      if(chromeRevision)chrome.setAttribute('data-pw-runtime-revision',chromeRevision);
      host.insertBefore(chrome,root);
    }
    var inner=chrome.querySelector('[data-pw-live-chrome-scale]');
    if(!inner){
      inner=document.createElement('div');
      inner.setAttribute('data-pw-live-chrome-scale','1');
      chrome.appendChild(inner);
    }
    var stale=inner.querySelector('header.pw-header,header.pw-shop-header,.pw-header,.pw-shop-header');
    if(stale&&stale!==header){
      try{stale.remove()}catch(eS){}
    }
    var i;
    for(i=0;i<nodes.length;i++){
      if(nodes[i].parentNode!==inner){
        try{inner.appendChild(nodes[i])}catch(eM){}
      }
    }
    if(inner.style)inner.style.removeProperty('margin-bottom');
  }
  function findLiveDockNavs(root){
    if(!root||!root.querySelectorAll)return [];
    var list=root.querySelectorAll('.pw-bottom-nav,.pw-shop-bottom-nav,.pw-pdp-sticky,[data-pw-pdp-bottom]');
    var pdp=null;
    var home=null;
    var i;
    for(i=0;i<list.length;i++){
      var el=list[i];
      if(el.closest&&el.closest('[data-pw-live-dock]'))continue;
      var isPdp=(el.getAttribute&&el.getAttribute('data-pw-pdp-bottom')==='1')||(el.classList&&el.classList.contains('pw-pdp-sticky'));
      if(isPdp){ if(!pdp) pdp=el; }
      else if(!home) home=el;
    }
    var out=[];
    if(pdp) out.push(pdp);
    if(home) out.push(home);
    return out;
  }
  function siblingDock(host){
    if(!host||!host.children)return null;
    var i;
    for(i=0;i<host.children.length;i++){
      var n=host.children[i];
      if(n.getAttribute&&n.getAttribute('data-pw-live-dock')==='1')return n;
    }
    return null;
  }
  function lockDockNavGeom(nav){
    if(!nav||!nav.style)return;
    nav.style.removeProperty('left');
    nav.style.removeProperty('top');
    nav.style.removeProperty('right');
    nav.style.removeProperty('bottom');
    nav.style.removeProperty('transform');
    nav.style.removeProperty('position');
    nav.style.removeProperty('width');
    nav.style.removeProperty('height');
    nav.style.removeProperty('inset');
    try{
      nav.removeAttribute('data-pw-user-move');
      nav.removeAttribute('data-pw-stay-scroll');
      nav.removeAttribute('data-pw-canvas-x');
      nav.removeAttribute('data-pw-canvas-y');
      nav.removeAttribute('data-pw-canvas-w');
      nav.removeAttribute('data-pw-canvas-h');
    }catch(eG){}
    var kids=nav.querySelectorAll?nav.querySelectorAll('a,button,[data-pw-chrome-btn],[data-pw-chrome-added]'):[];
    var ki;
    for(ki=0;ki<kids.length;ki++){
      var kid=kids[ki];
      if(kid.getAttribute&&kid.getAttribute('data-pw-chrome-float')==='1')continue;
      if(kid.style){
        kid.style.removeProperty('left');
        kid.style.removeProperty('top');
        kid.style.removeProperty('right');
        kid.style.removeProperty('bottom');
        kid.style.removeProperty('transform');
        kid.style.removeProperty('position');
      }
      try{kid.removeAttribute('data-pw-user-move')}catch(eK){}
    }
  }
  function pinPdpDockFaceLive(){
    if(isEditor())return;
    var page=(document.documentElement&&document.documentElement.getAttribute('data-pw-page'))||(document.body&&document.body.getAttribute('data-pw-page'));
    if(page!=='product')return;
    var dock=document.querySelector('[data-pw-chrome-kit="dock"]');
    if(!dock)return;
    var nav=dock.querySelector(':scope > .pw-pdp-sticky-nav');
    var ctas=dock.querySelector(':scope > .pw-pdp-sticky-ctas');
    if(!nav){
      nav=dock.querySelector('.pw-pdp-sticky-nav');
      if(nav) dock.appendChild(nav);
    }
    if(!nav){
      nav=document.createElement('div');
      nav.className='pw-pdp-sticky-nav';
      nav.setAttribute('data-pw-dock-show','pdp');
      dock.appendChild(nav);
    }
    if(!ctas){
      ctas=document.querySelector('body > .pw-pdp-sticky-ctas')||dock.querySelector('.pw-pdp-sticky-ctas');
      if(ctas) dock.appendChild(ctas);
    }
    if(!ctas){
      ctas=document.createElement('div');
      ctas.className='pw-pdp-sticky-ctas';
      ctas.setAttribute('data-pw-dock-show','pdp');
      dock.appendChild(ctas);
    }
    var stray=document.querySelectorAll('.pw-pdp-sticky,.pw-pdp-sticky-nav,.pw-pdp-sticky-ctas,[data-pw-pdp-bottom],body > [data-pw-dock-show="pdp"],body > [data-pw-chrome-btn="try-on"],body > [data-pw-chrome-btn="favorite-product"],body > [data-pw-chrome-btn="add-cart"],body > [data-pw-chrome-btn="buy-now"],header [data-pw-chrome-btn="try-on"],header [data-pw-chrome-btn="favorite-product"],header [data-pw-chrome-btn="add-cart"],header [data-pw-chrome-btn="buy-now"],.pw-header [data-pw-chrome-btn="try-on"],.pw-header [data-pw-chrome-btn="favorite-product"],.pw-shop-header [data-pw-chrome-btn="try-on"],.pw-shop-header [data-pw-chrome-btn="favorite-product"],[data-pw-live-chrome] [data-pw-chrome-btn="try-on"],[data-pw-live-chrome] [data-pw-chrome-btn="favorite-product"],[data-pw-live-chrome] [data-pw-chrome-btn="add-cart"],[data-pw-live-chrome] [data-pw-chrome-btn="buy-now"],main > .pw-shop-btn[data-pw-chrome-btn="try-on"],main > .pw-shop-btn[data-pw-chrome-btn="favorite-product"],main > .pw-shop-btn[data-pw-chrome-btn="add-cart"],main > .pw-shop-btn[data-pw-chrome-btn="buy-now"]');
    var i;
    for(i=0;i<stray.length;i++){
      var el=stray[i];
      if(!el||dock.contains(el))continue;
      if(el.closest&&el.closest('[data-pw-live-dock],.pw-pdp-actions,.pw-pdp-actions-inline'))continue;
      if(el.getAttribute&&el.getAttribute('data-pw-chrome-kit')==='dock')continue;
      if(el.classList&&el.classList.contains('pw-pdp-sticky-nav')){
        try{el.remove()}catch(eN){}
        continue;
      }
      if(el.classList&&el.classList.contains('pw-pdp-sticky-ctas')){
        var moved=el.querySelectorAll('[data-pw-chrome-btn]');
        var mi;
        for(mi=0;mi<moved.length;mi++){
          var mk=moved[mi].getAttribute('data-pw-chrome-btn')||'';
          if((mk==='add-cart'||mk==='buy-now')&&!ctas.querySelector('[data-pw-chrome-btn="'+mk+'"]')) ctas.appendChild(moved[mi]);
        }
        try{el.remove()}catch(eC){}
        continue;
      }
      if(el.classList&&el.classList.contains('pw-pdp-sticky')){
        var wrapBtns=el.querySelectorAll('[data-pw-chrome-btn]');
        var wi;
        for(wi=0;wi<wrapBtns.length;wi++){
          var wk=wrapBtns[wi].getAttribute('data-pw-chrome-btn')||'';
          if((wk==='add-cart'||wk==='buy-now')&&!ctas.querySelector('[data-pw-chrome-btn="'+wk+'"]')) ctas.appendChild(wrapBtns[wi]);
          else if((wk==='try-on'||wk==='favorite-product'||wk==='home')&&!nav.querySelector('[data-pw-chrome-btn="'+wk+'"]')) nav.appendChild(wrapBtns[wi]);
        }
        try{el.remove()}catch(eW){}
        continue;
      }
      var kind=el.getAttribute&&el.getAttribute('data-pw-chrome-btn')||'';
      var buyBox=document.querySelector('.pw-pdp-actions-inline,.pw-pdp-actions');
      var isBuyFace=!!(el.classList&&(el.classList.contains('pw-shop-btn')||el.classList.contains('pw-shop-btn-outline')));
      if(isBuyFace&&buyBox){
        if(!buyBox.contains(el)&&!buyBox.querySelector('[data-pw-chrome-btn="'+kind+'"]')) buyBox.appendChild(el);
        else if(!buyBox.contains(el)) try{el.remove()}catch(eBuy){}
        continue;
      }
      if(kind==='add-cart'||kind==='buy-now'){
        if(!ctas.querySelector('[data-pw-chrome-btn="'+kind+'"]')) ctas.appendChild(el);
        else try{el.remove()}catch(eB){}
        continue;
      }
      if(kind==='try-on'||kind==='favorite-product'||kind==='home'){
        if(!nav.querySelector('[data-pw-chrome-btn="'+kind+'"]')) nav.appendChild(el);
        else try{el.remove()}catch(eI){}
      }
    }
    var kids=dock.querySelectorAll('[data-pw-chrome-btn]');
    for(i=0;i<kids.length;i++){
      var btn=kids[i];
      if(btn.closest&&btn.closest('.pw-pdp-actions,.pw-pdp-actions-inline')) continue;
      if(btn.classList&&btn.classList.contains('pw-shop-btn-outline')) continue;
      var bk=btn.getAttribute('data-pw-chrome-btn')||'';
      var show=btn.getAttribute('data-pw-dock-show')||'';
      if(bk==='add-cart'||bk==='buy-now'){
        if(btn.parentNode!==ctas) ctas.appendChild(btn);
        continue;
      }
      if(show==='pdp'||bk==='try-on'||bk==='favorite-product'||btn.getAttribute('data-pw-pdp-home')==='1'||btn.getAttribute('data-pw-pdp-nav')==='1'){
        if(btn.parentNode!==nav) nav.appendChild(btn);
      }
    }
  }
  function hoistLiveDock(root){
    if(!root||isEditor())return;
    var navs=findLiveDockNavs(root);
    var host=root.parentNode||document.body;
    if(!host)return;
    var dock=currentRuntimeHost(siblingDock(host),root);
    if(!navs.length){
      if(dock&&!dock.querySelector('.pw-bottom-nav,.pw-shop-bottom-nav,.pw-pdp-sticky,[data-pw-pdp-bottom]')){
        try{dock.remove()}catch(eD){}
      }
      return;
    }
    if(!dock){
      dock=document.createElement('div');
      dock.setAttribute('data-pw-live-dock','1');
      var dockRevision=runtimeRevision(root);
      if(dockRevision)dock.setAttribute('data-pw-runtime-revision',dockRevision);
      host.appendChild(dock);
    }
    var stale=dock.querySelectorAll('.pw-bottom-nav,.pw-shop-bottom-nav,.pw-pdp-sticky,[data-pw-pdp-bottom]');
    var i;
    var j;
    for(i=0;i<stale.length;i++){
      var keep=false;
      for(j=0;j<navs.length;j++) if(navs[j]===stale[i]) keep=true;
      if(!keep) try{stale[i].remove()}catch(eS){}
    }
    for(i=0;i<navs.length;i++){
      lockDockNavGeom(navs[i]);
      if(navs[i].parentNode!==dock){
        try{dock.appendChild(navs[i])}catch(eM){}
      }
    }
  }
  function findLiveFloatKit(root){
    if(!root||!root.querySelector)return null;
    var kit=root.querySelector('[data-pw-chrome-kit="float"],[data-pw-chrome-float-host="1"]');
    if(kit)return kit;
    var layer=document.querySelector('[data-pw-live-fixed-layer]');
    return layer&&layer.querySelector?layer.querySelector('[data-pw-chrome-kit="float"],[data-pw-chrome-float-host="1"]'):null;
  }
  function hoistLiveFloat(root){
    if(!root||isEditor())return;
    var kit=findLiveFloatKit(root);
    if(!kit)return;
    var layer=ensureLayer(root);
    if(!layer)return;
    if(kit.parentNode!==layer){
      try{layer.appendChild(kit)}catch(eF){}
    }
  }
  function hoistLiveOverlays(){
    if(isEditor())return;
    var root=liveRoot();
    if(!root||!root.querySelectorAll)return;
    var nodes=root.querySelectorAll('[data-pw-cat-panel].is-open,.pw-cat-panel.is-open,.pw-shop-cat-panel.is-open,[data-pw-cat-acc-backdrop],.pw-cat-acc-backdrop');
    var i;
    for(i=0;i<nodes.length;i++){
      if(nodes[i].parentNode!==document.body){
        try{document.body.appendChild(nodes[i])}catch(eO){}
      }
    }
  }
  var rootWatch=null;
  var watchedRoot=null;
  function watchLiveRoot(root){
    if(!root||root===watchedRoot)return;
    if(rootWatch){try{rootWatch.disconnect()}catch(eD){}}
    watchedRoot=root;
    rootWatch=new MutationObserver(function(){
      if(findLiveHeader(root)||findLiveDockNavs(root).length||findLiveFloatKit(root))apply();
    });
    rootWatch.observe(root,{childList:true});
  }
  function ensureLayer(root){
    var host=root===document.body?document.body:(root.parentNode||document.body);
    var layer=currentRuntimeHost(host.querySelector('[data-pw-live-fixed-layer]'),root);
    if(layer)return layer;
    layer=document.createElement('div');
    layer.setAttribute('data-pw-live-fixed-layer','1');
    var layerRevision=runtimeRevision(root);
    if(layerRevision)layer.setAttribute('data-pw-runtime-revision',layerRevision);
    if(root!==host&&root.parentNode===host)host.insertBefore(layer,root);
    else host.insertBefore(layer,host.firstChild);
    return layer;
  }
  window.__pwViewportFixedHost=function(){
    return ensureLayer(liveRoot()||document.body);
  };
  function applySceneBox(el,x,y,w,h){
    if(!el||!el.style)return;
    el.style.setProperty('position','absolute','important');
    if(isFinite(x))el.style.setProperty('left',C.boxLeftCss?C.boxLeftCss(x,w):C.leftCss(x),'important');
    if(isFinite(y))el.style.setProperty('top',(C.boxTopPx?C.boxTopPx(y,h):y)+'px','important');
    el.style.setProperty('right','auto','important');
    el.style.setProperty('bottom','auto','important');
    el.style.setProperty('transform','none','important');
    el.style.setProperty('margin','0','important');
    if(isFinite(w)&&w>0)el.style.setProperty('width',w+'px','important');
    if(isFinite(h)&&h>0)el.style.setProperty('height',h+'px','important');
  }
  function bindSceneAbsolute(root){
    if(!root||!root.querySelectorAll)return;
    var sceneRoot=sceneCanvasOf(root);
    if(sceneRoot&&sceneRoot.setAttribute&&sceneRoot!==root&&!isBodyOrVisualHost(sceneRoot))sceneRoot.setAttribute('data-pw-scene-root','1');
    var nodes=Array.prototype.slice.call(root.querySelectorAll('[data-pw-placement="scene-absolute"],[data-pw-chrome-added="1"][data-pw-chrome-btn]:not([data-pw-chrome-kit])[data-pw-box-x]'));
    var host=root.parentNode;
    if(host&&host.children){
      var kids=host.children;
      var k;
      for(k=0;k<kids.length;k++){
        if(kids[k]!==root&&kids[k].getAttribute&&kids[k].getAttribute('data-pw-placement')==='scene-absolute'&&nodes.indexOf(kids[k])<0){
          nodes.push(kids[k]);
        }
      }
    }
    var i;
    var scenePx=W[band()]||W.desktop;
    for(i=0;i<nodes.length;i++){
      var el=nodes[i];
      if(!el||!el.style||el.closest&&el.closest('header,.pw-header,.pw-shop-header,.pw-bottom-nav,.pw-shop-bottom-nav,[data-pw-pdp-bottom],[data-pw-live-chrome],[data-pw-live-dock],[data-pw-chrome-kit="float"],[data-pw-chrome-float-host="1"]'))continue;
      if(isInFlowCatalogChrome(el)||staysInCatalogRow(el,sceneRoot))continue;
      if(el.getAttribute('data-pw-placement')==='viewport-fixed')continue;
      var box=readCanvasBox(el,scenePx,1);
      var needMove=el.parentNode!==sceneRoot;
      var br=null;
      if(needMove){
        try{br=el.getBoundingClientRect()}catch(eB){}
        try{sceneRoot.appendChild(el)}catch(eP){continue}
      }
      if(needMove&&br&&(br.width>0||br.height>0)&&sceneRoot.getBoundingClientRect){
        var sr=sceneRoot.getBoundingClientRect();
        var scale=sr.width>8&&scenePx>8?sr.width/scenePx:1;
        applySceneBox(
          el,
          (br.left+br.width/2-(sr.left+sr.width/2))/scale,
          (br.top+br.height/2-sr.top)/scale,
          br.width/scale,
          br.height/scale
        );
        continue;
      }
      applySceneBox(el,box.x,box.y,box.w,box.h);
    }
  }
  function bindFixed(root,scale,scenePx){
    if(!root)return;
    var layer=ensureLayer(root);
    var nodes=Array.prototype.slice.call(root.querySelectorAll('[data-pw-placement="viewport-fixed"],[data-pw-stay-scroll="1"],[data-pw-user-move="1"],[data-pw-added-bg="1"],[data-pw-chrome-added="1"],[data-pw-pin-screen="1"]'));
    var hoisted=layer.querySelectorAll('[data-pw-placement="viewport-fixed"],[data-pw-stay-scroll="1"],[data-pw-user-move="1"],[data-pw-added-bg="1"],[data-pw-chrome-added="1"],[data-pw-pin-screen="1"]');
    var hi;
    for(hi=0;hi<hoisted.length;hi++)if(nodes.indexOf(hoisted[hi])<0)nodes.push(hoisted[hi]);
    var i;
    for(i=0;i<nodes.length;i++){
      var el=nodes[i];
      if(!shouldBindFixed(el))continue;
      var box=readCanvasBox(el,scenePx,scale);
      if(el.parentNode!==layer){
        try{layer.appendChild(el)}catch(eM){}
      }
      if(!el.style)continue;
      el.style.pointerEvents=el.getAttribute('data-pw-added-bg')==='1'?'none':'auto';
      el.style.setProperty('position','fixed','important');
      var inner=window.innerWidth||scenePx;
      var innerH=window.innerHeight||720;
      var fr={left:0,top:0,width:inner,height:0};
      try{if(root.getBoundingClientRect)fr=root.getBoundingClientRect()}catch(eFr){}
      var map=C.createMap({
        device:band(),
        viewportWidth:inner,
        originX:(fr.left||0)+(fr.width||0)/2,
        originY:fr.top||0,
        scale:(fr.width>8&&scenePx>8)?fr.width/scenePx:(scale||1),
        fitWidth:false
      });
      var v4=!C.looksNorm(box.x,box.y)&&box.xu!=='norm'&&box.yu!=='norm';
      if(isFinite(box.x)||isFinite(box.y)){
        if(v4){
          var pt=C.sceneToClient({x:box.x||0,y:box.y||0},map);
          var tl=C.clientTopLeft?C.clientTopLeft(pt,box.w,box.h,map.scale):{x:pt.x-(box.w||0)*map.scale/2,y:pt.y-(box.h||0)*map.scale/2};
          if(isFinite(box.x))el.style.setProperty('left',tl.x+'px','important');
          if(isFinite(box.y))el.style.setProperty('top',tl.y+'px','important');
        }else{
          if(isFinite(box.x)){
            var leftPx=box.xu==='norm'?box.x*inner:(box.xu==='pct'?(box.x/100)*inner:box.x*scale);
            el.style.setProperty('left',leftPx+'px','important');
          }
          if(isFinite(box.y)){
            var topPx=box.yu==='norm'?box.y*innerH:(box.yu==='pct'?(box.y/100)*innerH:box.y*scale);
            el.style.setProperty('top',topPx+'px','important');
          }
        }
      }
      el.style.setProperty('right','auto','important');
      el.style.setProperty('bottom','auto','important');
      el.style.setProperty('transform','none','important');
      if(isFinite(box.w)&&box.w>0)el.style.setProperty('width',(box.w*scale)+'px','important');
      if(isFinite(box.h)&&box.h>0)el.style.setProperty('height',(box.h*scale)+'px','important');
    }
  }
  function apply(){
    var html=document.documentElement;
    if(!html||!html.style)return;
    var key=pick(band())||band();
    var px=W[key]||W.desktop;
    var z=zoomScale(px,key);
    html.setAttribute('data-pw-scene-lock',key);
    html.setAttribute('data-pw-edit-device',key);
    html.style.setProperty('--pw-scene-w',px+'px');
    html.style.setProperty('--pw-scene-zoom',String(z));
    if (z && z !== 1) html.setAttribute('data-pw-scene-zoomed','1');
    else html.removeAttribute('data-pw-scene-zoomed');
    var root=liveRoot();
    if(root){
      watchLiveRoot(root);
      if(!isEditor()){
        var contentRoot=ensureContentSceneRoot(root);
        var originReady=!root.querySelector('[data-pw-placement="scene-absolute"],[data-pw-added-text="1"],[data-pw-added-btn="1"],[data-pw-chrome-added="1"][data-pw-box-x]')||(contentRoot&&contentRoot.getAttribute&&contentRoot.getAttribute('data-pw-scene-origin')==='content');
        if(originReady){
          hoistLiveChrome(root,z);
          pinPdpDockFaceLive();
          hoistLiveDock(root);
          hoistLiveFloat(root);
          reflowInFlowStackHosts(sceneCanvasOf(root));
          bindSceneAbsolute(root);
          bindFixed(root,z,px);
          hoistLiveOverlays();
        }else if(!root.getAttribute('data-pw-scene-origin-retry')){
          root.setAttribute('data-pw-scene-origin-retry','1');
          requestAnimationFrame(function(){ apply(); });
        }
      }
    } else if(!isEditor()&&document.body){
      ensureContentSceneRoot(document.body);
      pinPdpDockFaceLive();
      reflowInFlowStackHosts(sceneCanvasOf(document.body));
      bindSceneAbsolute(document.body);
    }
    if(root&&root.style){
      var h=root.offsetHeight||0;
      if(z>1&&h>0)root.style.marginBottom=Math.round((z-1)*h)+'px';
      else root.style.removeProperty('margin-bottom');
    }
    var bgs=document.querySelectorAll('[data-pw-added-bg="1"]');
    var bi;
    for(bi=0;bi<bgs.length;bi++){
      var bg=bgs[bi];
      var sc=bg.getAttribute?String(bg.getAttribute('data-pw-scene')||''):'';
      if(sc==='2'||sc==='3'||sc==='4')continue;
      var ix=bg.getAttribute?bg.getAttribute('data-pw-bg-index'):'';
      if(bg.style)bg.style.setProperty('z-index',ix||'1','important');
    }
  }
  window.__pwSceneCenterApply=apply;
  apply();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply);
  window.addEventListener('resize',apply);
  if(window.visualViewport)window.visualViewport.addEventListener('resize',apply);
  if(!liveRoot()){
    var mo=new MutationObserver(function(){
      if(liveRoot()){apply();mo.disconnect();}
    });
    mo.observe(document.documentElement,{childList:true,subtree:true});
  }
})();`

export const PARTNER_SHOP_IMAGE_ZOOM_SCRIPT_ID = 'pw-shop-image-zoom'
export const PARTNER_SHOP_IMAGE_ZOOM_SCRIPT = `(function(){
  function viewH(){
    var vv=window.visualViewport;
    if(vv&&vv.height)return vv.height;
    return window.innerHeight||document.documentElement.clientHeight||0
  }
  function originY(el){
    if(!el||!el.getBoundingClientRect)return 50;
    var r=el.getBoundingClientRect();
    if(!(r.height>0))return 50;
    var h=viewH();
    if(!(h>0))return 50;
    return (h/2-r.top)/r.height*100;
  }
  function parseZ(el){
    var raw=el&&el.getAttribute?el.getAttribute('data-pw-banner-zoom'):'';
    var z=parseFloat(raw||'');
    if(isFinite(z)&&z>0)return Math.max(0.5,Math.min(3,z));
    var tr=el&&el.style?String(el.style.transform||''):'';
    var m=tr.match(/scale(?:Y)?\\(\\s*([\\d.]+)/);
    if(m){
      z=parseFloat(m[1]);
      if(isFinite(z)&&z>0)return Math.max(0.5,Math.min(3,z));
    }
    var bs=el&&el.style?String(el.style.backgroundSize||''):'';
    var two=bs.match(/(\\d+(?:\\.\\d+)?)%\\s+(\\d+(?:\\.\\d+)?)%/);
    if(two){
      z=parseFloat(two[2])/100;
      if(isFinite(z)&&z>0)return Math.max(0.5,Math.min(3,z));
    }
    m=bs.match(/(\\d+(?:\\.\\d+)?)%\\s*auto/);
    if(m){
      z=parseFloat(m[1])/100;
      if(isFinite(z)&&z>0)return Math.max(0.5,Math.min(3,z));
    }
    return 0;
  }
  function parsePan(el){
    var x=50,y=50;
    var ax=el&&el.getAttribute?el.getAttribute('data-pw-banner-pan-x'):'';
    var ay=el&&el.getAttribute?el.getAttribute('data-pw-banner-pan-y'):'';
    if(ax!=null&&ax!==''){var px=parseFloat(ax);if(isFinite(px))x=Math.max(0,Math.min(100,px));}
    if(ay!=null&&ay!==''){var py=parseFloat(ay);if(isFinite(py))y=Math.max(0,Math.min(100,py));}
    return {x:x,y:y};
  }
  function applyImg(img,z,pan,box){
    if(!img||!img.style)return;
    var host=box||(img.parentElement||img);
    var x=pan&&isFinite(pan.x)?pan.x:50;
    var y=pan&&isFinite(pan.y)?pan.y:50;
    if(host&&host.style&&host!==img){
      try{
        var hp=window.getComputedStyle(host).position;
        if(!hp||hp==='static')host.style.position='relative';
      }catch(eH){}
      host.style.overflow='hidden';
      var wrap=img.parentElement;
      if(wrap&&wrap!==host&&wrap!==document.body&&!(wrap.querySelector&&wrap.querySelector('h1,[data-pw-el="title"],[data-pw-el="copy"]'))){
        wrap.style.position='absolute';
        wrap.style.inset='0';
        wrap.style.width='100%';
        wrap.style.height='100%';
        wrap.style.overflow='hidden';
        wrap.style.transform='none';
      }
    }
    img.style.setProperty('position','absolute');
    img.style.setProperty('left','0');
    img.style.setProperty('top','0');
    img.style.setProperty('right','0');
    img.style.setProperty('bottom','0');
    img.style.setProperty('object-fit','cover');
    img.style.setProperty('object-position',Math.round(x)+'% '+Math.round(y)+'%');
    img.style.setProperty('transform-origin',Math.round(x)+'% '+Math.round(y)+'%');
    img.style.setProperty('transform',z&&z!==1?('scale('+z+')'):'none');
    img.style.setProperty('width','100%');
    img.style.setProperty('height','100%');
    img.style.setProperty('max-width','none');
    img.style.setProperty('max-height','none');
  }
  function applyHost(host){
    var z=parseZ(host);
    var pan=parsePan(host);
    var img=host.querySelector&&host.querySelector('img[data-pw-el="media"],img[data-pw-banner-zoom],img[data-pw-edit*="hero"],img[data-pw-edit*="banner"]');
    if(!img&&host.querySelector){
      var imgs=host.querySelectorAll('img');
      var j;
      for(j=0;j<imgs.length;j++){
        var cls=String(imgs[j].className||'');
        if(/logo/i.test(cls)||(imgs[j].getAttribute&&imgs[j].getAttribute('data-pw-logo-added')))continue;
        img=imgs[j];
        break;
      }
    }
    if(z){
      var size=Math.round(z*100)+'% auto';
      if(host.style.backgroundImage||(host.style.backgroundSize&&String(host.style.backgroundSize).indexOf('%')>=0)){
        host.style.backgroundSize=z===1?'cover':size;
        host.style.backgroundPosition=Math.round(pan.x)+'% '+Math.round(pan.y)+'%';
      }
    }
    if(img)applyImg(img,parseZ(img)||z||1,pan,host);
  }
  function run(){
    var hosts=document.querySelectorAll('[data-pw-region="banner"],.pw-hero,.pw-banner,.pw-shop-hero,.pw-shop-banner,[data-pw-banner-zoom]');
    var i;
    for(i=0;i<hosts.length;i++){
      if(hosts[i].tagName&&hosts[i].tagName.toLowerCase()==='img')continue;
      applyHost(hosts[i]);
    }
    var loose=document.querySelectorAll('img[data-pw-banner-zoom]');
    for(i=0;i<loose.length;i++){
      var img=loose[i];
      var host=img.parentElement||img;
      applyImg(img,parseZ(img)||1,parsePan(host),host);
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);
  else run();
  window.addEventListener('resize',run);
  window.addEventListener('load',run);
  if(window.visualViewport)window.visualViewport.addEventListener('resize',run);
})();`
