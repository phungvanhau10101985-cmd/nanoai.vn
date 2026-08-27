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

/** Chrome header đang chạy ở z 200 — phần tử mới rơi vào lớp giữa cho khớp. */
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
 * Z của **từng** phần tử đứng im lớp dưới — trên catalog (z 2), dưới header (200).
 * Không gắn số này lên cả tấm neo (cấm 210 / restack host).
 */
export const PW_STAY_HOIST_LAYER_Z = pwSceneZ(1)

/**
 * Một hệ lớp. Lớp 0 (nền) là chuẩn; mọi `data-pw-scene` dùng cùng dải z.
 * Nền thêm lớp dưới (không đứng im) giữ stack nền 1,2… — không nhảy dải 100.
 * Nền đứng im lớp dưới dùng `pwSceneStayScrollZCss` (100).
 */
export function pwSceneUnifiedStackCss(): string {
  return [
    `[data-pw-scene="0"]{z-index:${pwSceneZ(0)}!important}`,
    `[data-pw-scene="1"]:not([data-pw-added-bg]){z-index:${pwSceneZ(1)}!important}`,
    `[data-pw-scene="2"]{z-index:${pwSceneZ(2)}!important}`,
    `[data-pw-scene="3"]{z-index:${pwSceneZ(3)}!important}`,
    `[data-pw-scene="4"]{z-index:${pwSceneZ(4)}!important}`,
    pwSceneStayScrollZCss(),
    pwSceneChromeZCss(),
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

/** Header / topbar / thanh đáy — chrome lớp cao giữ trong header (z 200) để thắng nền đứng im fixed z 100. */
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
export const PW_SCENE_DESIGN_WIDTH = {
  mobile: 390,
  tablet: 768,
  laptop: 1280,
  desktop: 1280,
} as const

/**
 * Khung vẽ căn giữa màn hình — cùng số với iframe Sửa nhanh / `?pw-device=`.
 * Desktop dùng 1440 (khung rộng) để đường tâm trùng trung điểm màn hình lớn.
 */
export const PW_SCENE_CANVAS_WIDTH = {
  mobile: 390,
  tablet: 768,
  laptop: 1280,
  desktop: 1440,
} as const

export type PwSceneDevice = keyof typeof PW_SCENE_DESIGN_WIDTH

export function pwSceneDesignWidth(device: unknown): number {
  const key = String(device ?? '') as PwSceneDevice
  return PW_SCENE_DESIGN_WIDTH[key] ?? PW_SCENE_DESIGN_WIDTH.desktop
}

export function pwSceneCanvasWidth(device: unknown): number {
  const key = String(device ?? '') as keyof typeof PW_SCENE_CANVAS_WIDTH
  return PW_SCENE_CANVAS_WIDTH[key] ?? PW_SCENE_CANVAS_WIDTH.desktop
}

/**
 * Chọn máy theo bề rộng cửa sổ, không theo CSS px sau khi Ctrl +/- zoom.
 * Gọi với `max(outerWidth, innerWidth)` để zoom không đổi laptop ↔ desktop.
 */
export function pwSceneLockFromWindowWidth(width: unknown): PwSceneDevice {
  const w = Number(width)
  if (!Number.isFinite(w) || w < PW_SCENE_CANVAS_WIDTH.tablet) return 'mobile'
  if (w < PW_SCENE_CANVAS_WIDTH.laptop) return 'tablet'
  if (w < PW_SCENE_CANVAS_WIDTH.desktop) return 'laptop'
  return 'desktop'
}

/** Khi shop chưa lưu bản laptop/tablet, khóa đúng máy đó sẽ ẩn hết và trang trắng. */
export const PW_SCENE_LOCK_FALLBACK: Record<PwSceneDevice, readonly PwSceneDevice[]> = {
  desktop: ['desktop', 'laptop', 'tablet', 'mobile'],
  laptop: ['laptop', 'desktop', 'tablet', 'mobile'],
  tablet: ['tablet', 'laptop', 'desktop', 'mobile'],
  mobile: ['mobile', 'tablet', 'laptop', 'desktop'],
}

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

export const PW_SCENE_WIDE_HOSTS = [
  'html[data-pw-edit-device="laptop"]',
  'html[data-pw-edit-device="desktop"]',
  'html[data-pw-scene-lock="laptop"]',
  'html[data-pw-scene-lock="desktop"]',
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
  '[data-pw-chrome-added]:not([data-pw-chrome-count]):not([data-pw-el="search"]):not(.pw-header-search):not(.pw-shop-search-wrap)'

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
    `html[data-pw-scene-lock="${lock}"] .pw-visual-${lock}{display:block!important}`
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

/**
 * Live copies the Sửa nhanh canvas 1:1 then scales it to the CSS viewport.
 * `sceneW` omitted → 1 (Sửa nhanh iframe is already the canvas).
 */
export function pwSceneLiveZoomScale(
  innerWidth: unknown,
  outerWidth: unknown,
  screenWidth?: unknown,
  sceneW?: unknown
): number {
  void outerWidth
  void screenWidth
  const inner = Number(innerWidth)
  const w = Number(sceneW)
  if (!(inner > 8) || !(w > 8)) return 1
  return inner / w
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
  object-fit:cover!important;box-sizing:border-box
}
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
.pw-hero,.pw-banner,.pw-shop-hero,.pw-shop-banner,[data-pw-region="banner"]{margin-top:0!important;border-radius:0!important}
.pw-btn-hero{border:none!important}
`
)}
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
 * Host sticky không scale; mặt header scale cùng `--pw-scene-zoom`.
 * Thanh đáy / PDP sticky hoist ra [data-pw-live-dock] (fixed đáy viewport, không transform).
 */
export function pwSceneLiveChromeCss(): string {
  return [
    `[${PW_LIVE_CHROME_ATTR}]{position:sticky!important;top:0!important;z-index:200!important;width:100%;display:flex;flex-direction:column;align-items:flex-start;box-sizing:border-box}`,
    `[${PW_LIVE_CHROME_SCALE_ATTR}]{width:var(--pw-scene-w)!important;transform-origin:top left;display:flex;flex-direction:column;flex:0 0 auto;box-sizing:border-box}`,
    `html[data-pw-scene-zoomed="1"] [${PW_LIVE_CHROME_SCALE_ATTR}]{transform:scale(var(--pw-scene-zoom,1))}`,
    `[${PW_LIVE_CHROME_ATTR}] .pw-header,[${PW_LIVE_CHROME_ATTR}] .pw-shop-header{position:relative!important;top:auto!important;width:100%!important}`,
    `[${PW_LIVE_CHROME_PH_ATTR}]{display:block;width:100%;pointer-events:none;visibility:hidden}`,
    `html[data-pw-scene-zoomed="1"] [data-pw-inline-visual-root] .pw-header,html[data-pw-scene-zoomed="1"] [data-pw-inline-visual-root] .pw-shop-header{position:relative!important;top:auto!important}`,
    pwSceneLiveDockCss(),
  ].join('')
}

/** Thanh đáy live: host fixed viewport, không nằm trong canvas `transform:scale`. */
export function pwSceneLiveDockCss(): string {
  return [
    `[${PW_LIVE_DOCK_ATTR}]{position:fixed!important;left:0!important;right:0!important;bottom:0!important;top:auto!important;z-index:200!important;width:100%;max-width:100%;display:flex;flex-direction:column;align-items:stretch;box-sizing:border-box;pointer-events:none;transform:none!important}`,
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
    `@media (min-width:${d}px){html:not([data-pw-edit-device]):not([data-pw-scene-lock]){--pw-scene-w:${d}px}}`,
    // Sửa nhanh: body trong iframe đúng khổ máy. Live: cùng khổ rồi scale phủ viewport.
    // `transform:scale` (kể cả scale(1)) tạo containing block → sticky header “nặn xuống”.
    // Chỉ scale khi zoom thật; header hoist ra [data-pw-live-chrome] (sticky, không transform trên host).
    `html[data-pw-edit-device] body{width:var(--pw-scene-w)!important;min-width:var(--pw-scene-w)!important;max-width:none!important;margin-left:calc(50% - (var(--pw-scene-w) / 2))!important;margin-right:auto!important;box-sizing:border-box;overflow-x:visible;transform-origin:top center;display:block}`,
    `[data-pw-inline-visual-root]{width:var(--pw-scene-w)!important;min-width:var(--pw-scene-w)!important;max-width:none!important;margin-left:0!important;margin-right:calc(var(--pw-scene-w) * (var(--pw-scene-zoom,1) - 1))!important;box-sizing:border-box;overflow-x:visible;transform-origin:top left;transform:none;display:block}`,
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
/** Khóa máy theo outerWidth (không đổi khi Ctrl +/-) rồi copy canvas Sửa nhanh phủ viewport. */
export const PARTNER_SHOP_SCENE_CENTER_SCRIPT = `(function(){
  var W={mobile:${PW_SCENE_CANVAS_WIDTH.mobile},tablet:${PW_SCENE_CANVAS_WIDTH.tablet},laptop:${PW_SCENE_CANVAS_WIDTH.laptop},desktop:${PW_SCENE_CANVAS_WIDTH.desktop}};
  function stamped(){
    var html=document.documentElement;
    return html&&html.getAttribute?String(html.getAttribute('data-pw-edit-device')||''):'';
  }
  function band(){
    var s=stamped();
    if(s==='mobile'||s==='tablet'||s==='laptop'||s==='desktop')return s;
    var outer=window.outerWidth||0;
    var inner=window.innerWidth||(document.documentElement&&document.documentElement.clientWidth)||0;
    var w=Math.max(outer,inner);
    if(!(w>0))return 'desktop';
    if(w<W.tablet)return 'mobile';
    if(w<W.laptop)return 'tablet';
    if(w<W.desktop)return 'laptop';
    return 'desktop';
  }
  function liveRoot(){
    return document.querySelector('[data-pw-inline-visual-root]');
  }
  function zoomScale(scenePx){
    var root=liveRoot();
    if(!root)return 1;
    var inner=window.innerWidth||(document.documentElement&&document.documentElement.clientWidth)||0;
    if(!(inner>8)||!(scenePx>8))return 1;
    return inner/scenePx;
  }
  function hasWrap(k){
    return document.querySelector('.pw-visual-'+k+',[data-pw-visual-device="'+k+'"]');
  }
  function pick(preferred){
    var order={desktop:['desktop','laptop','tablet','mobile'],laptop:['laptop','desktop','tablet','mobile'],tablet:['tablet','laptop','desktop','mobile'],mobile:['mobile','tablet','laptop','desktop']};
    var list=order[preferred]||order.desktop;
    var i;
    for(i=0;i<list.length;i++) if(hasWrap(list[i])) return list[i];
    return '';
  }
  function parsePx(v){
    var n=parseFloat(String(v==null?'':v));
    return isFinite(n)?n:NaN;
  }
  function isChromeFloat(el){
    var k=el&&el.getAttribute?String(el.getAttribute('data-pw-chrome-btn')||''):'';
    return k==='chat'||k==='chat-zalo'||k==='chat-facebook'||k==='chat-instagram'||k==='chat-whatsapp'||k==='topup';
  }
  function isPct(raw){
    return String(raw||'').indexOf('%')>=0;
  }
  function readCanvasBox(el,scenePx,scale){
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
    if(el.closest&&el.closest('header,.pw-header,.pw-shop-header,[data-pw-live-chrome],[data-pw-live-dock],.pw-bottom-nav,.pw-shop-bottom-nav,.pw-pdp-actions,.pw-pdp-sticky,[data-pw-pdp-bottom]'))return false;
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
  function hoistLiveChrome(root,scale){
    if(!root||isEditor())return;
    var header=findLiveHeader(root);
    var host=root.parentNode||document.body;
    if(!host)return;
    var chrome=siblingChrome(host);
    var z=scale>0?scale:1;
    var leftover=root.querySelector('[data-pw-live-chrome-ph]');
    if(leftover)try{leftover.remove()}catch(ePh){}
    if(!header){
      if(!chrome)return;
      var inner0=chrome.querySelector('[data-pw-live-chrome-scale]')||chrome;
      var h0=inner0.offsetHeight||0;
      if(inner0.style)inner0.style.marginBottom=z!==1&&h0>0?Math.round((z-1)*h0)+'px':'';
      return;
    }
    var nodes=[];
    var prev=header.previousElementSibling;
    if(prev&&prev.matches&&prev.matches('.pw-topbar,.pw-shop-topbar,[data-pw-region="topbar"]'))nodes.push(prev);
    nodes.push(header);
    if(!chrome){
      chrome=document.createElement('div');
      chrome.setAttribute('data-pw-live-chrome','1');
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
    var ih=inner.offsetHeight||0;
    if(inner.style)inner.style.marginBottom=z!==1&&ih>0?Math.round((z-1)*ih)+'px':'';
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
  function hoistLiveDock(root){
    if(!root||isEditor())return;
    var navs=findLiveDockNavs(root);
    var host=root.parentNode||document.body;
    if(!host)return;
    var dock=siblingDock(host);
    if(!navs.length){
      if(dock&&!dock.querySelector('.pw-bottom-nav,.pw-shop-bottom-nav,.pw-pdp-sticky,[data-pw-pdp-bottom]')){
        try{dock.remove()}catch(eD){}
      }
      return;
    }
    if(!dock){
      dock=document.createElement('div');
      dock.setAttribute('data-pw-live-dock','1');
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
  function watchLiveRoot(root){
    if(!root||rootWatch)return;
    rootWatch=new MutationObserver(function(){
      if(findLiveHeader(root)||findLiveDockNavs(root).length)apply();
    });
    rootWatch.observe(root,{childList:true});
  }
  function ensureLayer(root){
    var host=root.parentNode||document.body;
    var layer=host.querySelector('[data-pw-live-fixed-layer]');
    if(layer)return layer;
    layer=document.createElement('div');
    layer.setAttribute('data-pw-live-fixed-layer','1');
    host.insertBefore(layer,root);
    return layer;
  }
  function bindFixed(root,scale,scenePx){
    if(!root)return;
    var layer=ensureLayer(root);
    var nodes=document.querySelectorAll('[data-pw-stay-scroll="1"],[data-pw-user-move="1"],[data-pw-added-bg="1"],[data-pw-chrome-added="1"],[data-pw-pin-screen="1"]');
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
      if(isFinite(box.x)){
        var leftPx=box.xu==='pct'?(box.x/100)*inner:box.x*scale;
        el.style.setProperty('left',leftPx+'px','important');
      }
      if(isFinite(box.y)){
        var topPx=box.yu==='pct'?(box.y/100)*innerH:box.y*scale;
        el.style.setProperty('top',topPx+'px','important');
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
    var z=zoomScale(px);
    html.setAttribute('data-pw-scene-lock',key);
    html.setAttribute('data-pw-edit-device',key);
    html.style.setProperty('--pw-scene-w',px+'px');
    html.style.setProperty('--pw-scene-zoom',String(z));
    if (z && z !== 1) html.setAttribute('data-pw-scene-zoomed','1');
    else html.removeAttribute('data-pw-scene-zoomed');
    var root=liveRoot();
    if(root){
      watchLiveRoot(root);
      hoistLiveChrome(root,z);
      hoistLiveDock(root);
      hoistLiveOverlays();
    }
    if(root&&root.style){
      var h=root.scrollHeight||0;
      root.style.marginBottom=z!==1&&h>0?Math.round((z-1)*h)+'px':'';
      bindFixed(root,z,px);
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
    var m=tr.match(/scale(?:Y)?\(\s*([\d.]+)/);
    if(m){
      z=parseFloat(m[1]);
      if(isFinite(z)&&z>0)return Math.max(0.5,Math.min(3,z));
    }
    var bs=el&&el.style?String(el.style.backgroundSize||''):'';
    var two=bs.match(/(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%/);
    if(two){
      z=parseFloat(two[2])/100;
      if(isFinite(z)&&z>0)return Math.max(0.5,Math.min(3,z));
    }
    m=bs.match(/(\d+(?:\.\d+)?)%\s*auto/);
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
