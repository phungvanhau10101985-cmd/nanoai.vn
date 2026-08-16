/**
 * Stack lớp nền toàn trang — dùng chung mọi giao diện shop/landing.
 * Lớp 0 = nền trắng (canvas). Mỗi nền một lớp. Thêm nền / đưa lên / đưa xuống đi từng lớp.
 * Không dùng data-pw-bg-layer (đó là hit-layer ảnh banner).
 */

export const PW_BG_INDEX_ATTR = 'data-pw-bg-index'
export const PW_BG_ROLE_ATTR = 'data-pw-bg-role'

export const PW_BG_CANVAS_INDEX = 0
export const PW_BG_HEADER_Z = 200

/** Lớp đặc biệt — không phải region. */
export const PW_BG_SPECIAL_ROLES = ['canvas', 'added'] as const

/** Region được phép có nền — `data-pw-bg-role` cùng tên `data-pw-region`. */
export const PW_BG_REGION_ROLES = [
  'header',
  'banner',
  'categories',
  'catalog',
  'promo',
  'footer',
  'content',
  'form',
  'gallery',
  'pdp-info',
  'reviews',
  'cart-list',
  'cart-summary',
  'account-nav',
  'account-main',
] as const

export const PW_BG_BUILTIN_ORDER = [
  'canvas',
  ...PW_BG_REGION_ROLES,
] as const

export const PW_BG_ROLES = [...PW_BG_BUILTIN_ORDER, 'added'] as const

export type PwBgStackRole = (typeof PW_BG_ROLES)[number]
export type PwBgRegionRole = (typeof PW_BG_REGION_ROLES)[number]

export const PW_BG_LOCKED_ROLES: readonly PwBgStackRole[] = ['canvas', 'header']

/** Chỉ các lớp cũ mới gán z-index khi paint — region mới chỉ gắn mã, không đổi layout. */
export const PW_BG_PAINT_Z_ROLES: readonly PwBgStackRole[] = [
  'canvas',
  'header',
  'banner',
  'categories',
  'catalog',
  'promo',
  'footer',
  'added',
]

export type PwBgStackItem = {
  index: number
  role: PwBgStackRole
  locked: boolean
  current?: boolean
}

export function isPwBgStackRole(raw: string | null | undefined): raw is PwBgStackRole {
  return PW_BG_ROLES.includes(String(raw || '') as PwBgStackRole)
}

export function isPwBgRegionRole(raw: string | null | undefined): raw is PwBgRegionRole {
  return (PW_BG_REGION_ROLES as readonly string[]).includes(String(raw || ''))
}

export function isPwBgPaintZRole(raw: string | null | undefined): boolean {
  return (PW_BG_PAINT_Z_ROLES as readonly string[]).includes(String(raw || ''))
}

export function pwBgRoleOrder(role: string): number {
  if (role === 'added') return 50
  const i = PW_BG_BUILTIN_ORDER.indexOf(role as PwBgStackRole)
  return i < 0 ? 99 : i
}

export function isPwBgLockedRole(role: string): boolean {
  return (PW_BG_LOCKED_ROLES as readonly string[]).includes(role)
}

/** z-index vẽ: canvas 0, header chrome 200, các lớp còn lại = index. */
export function pwBgPaintZ(role: string, index: number): number {
  if (role === 'canvas') return PW_BG_CANVAS_INDEX
  if (role === 'header') return PW_BG_HEADER_Z
  return Math.max(0, Math.round(index))
}

export function parsePwBgStack(raw: unknown): PwBgStackItem[] {
  if (!Array.isArray(raw)) return []
  const out: PwBgStackItem[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const rec = row as { index?: unknown; role?: unknown; locked?: unknown; current?: unknown }
    const role = String(rec.role || '')
    if (!isPwBgStackRole(role)) continue
    const index = Number(rec.index)
    if (!Number.isFinite(index) || index < 0) continue
    out.push({
      index,
      role,
      locked: rec.locked === true || isPwBgLockedRole(role),
      current: rec.current === true,
    })
  }
  return out.sort((a, b) => a.index - b.index)
}
