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

/** Biến CSS dùng chung cho Sửa nhanh và trang khách — hai bên phải cùng số. */
export function pwSceneCssVars(device: unknown): string {
  return `--pw-scene-w:${pwSceneCanvasWidth(device)}px`
}

/** Đường tâm mọi máy = trung điểm màn hình. Inject vào chrome layout dùng chung. */
export function pwSceneCenterCss(): string {
  const m = PW_SCENE_CANVAS_WIDTH.mobile
  const t = PW_SCENE_CANVAS_WIDTH.tablet
  const l = PW_SCENE_CANVAS_WIDTH.laptop
  const d = PW_SCENE_CANVAS_WIDTH.desktop
  return [
    `html{--pw-scene-w:${d}px}`,
    `html[data-pw-edit-device="mobile"]{--pw-scene-w:${m}px}`,
    `html[data-pw-edit-device="tablet"]{--pw-scene-w:${t}px}`,
    `html[data-pw-edit-device="laptop"]{--pw-scene-w:${l}px}`,
    `html[data-pw-edit-device="desktop"]{--pw-scene-w:${d}px}`,
    `@media (max-width:${t - 1}px){html:not([data-pw-edit-device]){--pw-scene-w:${m}px}}`,
    `@media (min-width:${t}px) and (max-width:${l - 1}px){html:not([data-pw-edit-device]){--pw-scene-w:${t}px}}`,
    `@media (min-width:${l}px) and (max-width:${d - 1}px){html:not([data-pw-edit-device]){--pw-scene-w:${l}px}}`,
    `@media (min-width:${d}px){html:not([data-pw-edit-device]){--pw-scene-w:${d}px}}`,
    `html[data-pw-edit-device] body{width:min(100%,var(--pw-scene-w));margin-left:auto;margin-right:auto}`,
  ].join('')
}
