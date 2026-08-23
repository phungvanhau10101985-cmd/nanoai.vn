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
  return [2, 3, 4]
    .map(
      (index) =>
        `[data-pw-chrome-btn][data-pw-scene="${index}"],[data-pw-chrome-added][data-pw-scene="${index}"]{z-index:${pwSceneZ(index)}!important}`
    )
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

/** Browser zoom should shrink/grow the shop naturally; only the canvas center is locked. */
export function pwSceneLiveZoomScale(
  innerWidth: unknown,
  outerWidth: unknown,
  screenWidth?: unknown
): number {
  void innerWidth
  void outerWidth
  void screenWidth
  return 1
}

/** Biến CSS dùng chung cho Sửa nhanh và trang khách — hai bên phải cùng số. */
export function pwSceneCssVars(device: unknown): string {
  return `--pw-scene-w:${pwSceneCanvasWidth(device)}px`
}

/** Ảnh banner luôn phủ kín khối — kéo = đổi crop, không dịch tấm ra khỏi khung. */
export const PARTNER_SHOP_BANNER_MEDIA_FILL_CSS = `
html [data-pw-region="banner"],html .pw-hero,html .pw-banner,html .pw-shop-hero,html .pw-shop-banner{overflow:hidden}
html [data-pw-region="banner"] img[data-pw-el="media"],
html [data-pw-region="banner"] img[data-pw-banner-zoom],
html .pw-hero img[data-pw-el="media"],html .pw-banner img[data-pw-el="media"],
html .pw-shop-hero img[data-pw-el="media"],html .pw-shop-banner img[data-pw-el="media"]{
  position:absolute!important;inset:0!important;left:0!important;top:0!important;right:0!important;bottom:0!important;
  width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;
  object-fit:cover!important;box-sizing:border-box
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
    // Sửa nhanh: body trong iframe. Xem thật: neo #shop root — không khóa body Next.js
    // (html co theo body thì calc(50%-khung/2) = 0 → cả trang dạt trái).
    `html[data-pw-edit-device] body{width:var(--pw-scene-w)!important;min-width:var(--pw-scene-w)!important;max-width:none!important;margin-left:calc(50% - (var(--pw-scene-w) / 2))!important;margin-right:auto!important;box-sizing:border-box;overflow-x:visible;transform-origin:top center;display:block}`,
    `[data-pw-inline-visual-root]{width:var(--pw-scene-w)!important;min-width:var(--pw-scene-w)!important;max-width:none!important;margin-left:calc(50% - (var(--pw-scene-w) / 2))!important;margin-right:auto!important;box-sizing:border-box;overflow-x:visible;transform-origin:top center;display:block}`,
    `html[data-pw-scene-zoomed="1"] [data-pw-inline-visual-root]{transform:scale(var(--pw-scene-zoom,1))}`,
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
/** Khóa máy theo outerWidth (không đổi khi Ctrl +/-) rồi neo canvas giữa màn hình. */
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
  function zoomScale(){
    return 1;
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
  function apply(){
    var html=document.documentElement;
    if(!html||!html.style)return;
    var key=pick(band());
    if(!key)return;
    var px=W[key]||W.desktop;
    var z=zoomScale();
    html.setAttribute('data-pw-scene-lock',key);
    html.style.setProperty('--pw-scene-w',px+'px');
    html.style.setProperty('--pw-scene-zoom',String(z));
    if (z && z !== 1) html.setAttribute('data-pw-scene-zoomed','1');
    else html.removeAttribute('data-pw-scene-zoomed');
    var root=document.querySelector('[data-pw-inline-visual-root]');
    if(root&&root.style){
      root.style.marginBottom='';
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
  apply();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply);
  window.addEventListener('resize',apply);
  if(window.visualViewport)window.visualViewport.addEventListener('resize',apply);
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
