import { PW_SCENE_ATTR } from './pw-scene'

/** Nền thêm — Lớp dưới. */
export const PW_KIND_SCENE_BG = 1
/** Lưới SP / ảnh / video / banner — Lớp giữa. */
export const PW_KIND_SCENE_MEDIA = 2
/** Chữ Thêm — Lớp trên. */
export const PW_KIND_SCENE_TEXT = 3
/** Nút chức năng / nút Thêm — Lớp nổi. */
export const PW_KIND_SCENE_CHROME = 4

export const PW_KIND_SCENE = {
  bg: PW_KIND_SCENE_BG,
  media: PW_KIND_SCENE_MEDIA,
  text: PW_KIND_SCENE_TEXT,
  chrome: PW_KIND_SCENE_CHROME,
} as const

export function pwKindSceneAttr(index: number): string {
  return ` ${PW_SCENE_ATTR}="${Math.round(index)}"`
}

function attrOf(get: (name: string) => string | null | undefined, name: string): string {
  const raw = get(name)
  return raw == null ? '' : String(raw).trim()
}

function hasAttr(get: (name: string) => string | null | undefined, name: string): boolean {
  return get(name) != null
}

/**
 * Lớp khóa theo kind. `null` = không khóa (header / footer / kit / mặt đất).
 * Mid-chrome / nút Thêm thắng catalog khi nút nằm trong hàng lưới.
 */
export function kindLockedSceneFromAttrs(
  get: (name: string) => string | null | undefined
): number | null {
  if (attrOf(get, 'data-pw-chrome-kit')) return null
  if (attrOf(get, 'data-pw-added-btn') === '1') return PW_KIND_SCENE_CHROME
  if (attrOf(get, 'data-pw-chrome-added') === '1' && attrOf(get, 'data-pw-chrome-btn')) {
    return PW_KIND_SCENE_CHROME
  }
  if (attrOf(get, 'data-pw-added-text') === '1') return PW_KIND_SCENE_TEXT
  if (attrOf(get, 'data-pw-added-bg') === '1') return PW_KIND_SCENE_BG
  if (
    attrOf(get, 'data-pw-added-image') === '1' ||
    attrOf(get, 'data-pw-added-video') === '1' ||
    attrOf(get, 'data-pw-added-catalog') === '1' ||
    attrOf(get, 'data-pw-featured-categories') === '1' ||
    attrOf(get, 'data-pw-added-banner') === '1' ||
    attrOf(get, 'data-pw-related') === '1' ||
    attrOf(get, 'data-pw-outfit') === '1' ||
    hasAttr(get, 'data-pw-catalog') ||
    attrOf(get, 'data-pw-personalize') !== '' ||
    attrOf(get, 'data-pw-region') === 'banner'
  ) {
    return PW_KIND_SCENE_MEDIA
  }
  return null
}
