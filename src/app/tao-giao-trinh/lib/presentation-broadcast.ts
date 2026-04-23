/**
 * Đồng bộ trình chiếu GV ↔ HS qua BroadcastChannel.
 * Tên kênh cố định cho mọi tab → hai cửa sổ HS / hai tab GV cùng lúc bị “nhảy loạn”.
 * Mỗi tab GV có một `syncId` (query `?sync=` trên URL HS); kênh = `PREFIX + syncId`.
 */
export const PRESENTATION_SYNC_QUERY_KEY = 'sync' as const

/** Kênh legacy (không có ?sync=) — chỉ để tương thích bookmark cũ; nên tránh mở nhiều HS cùng lúc. */
export const LEGACY_PRESENTATION_BROADCAST_CHANNEL = 'tao-giao-trinh-sync' as const

const SCOPED_PREFIX = `${LEGACY_PRESENTATION_BROADCAST_CHANNEL}:` as const

export function getPresentationBroadcastChannelName(syncId: string | null | undefined): string {
  const s = typeof syncId === 'string' ? syncId.trim() : ''
  if (s.length > 0) return `${SCOPED_PREFIX}${s}`
  return LEGACY_PRESENTATION_BROADCAST_CHANNEL
}

/** Tạo id ổn định cho một tab (client-only). */
export function createPresentationSyncId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `p${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

/**
 * Ổn định `syncId` theo từng tab browser.
 * - Cùng tab: reload/remount vẫn giữ nguyên id => cửa sổ HS không bị rớt kênh.
 * - Khác tab: sessionStorage tách biệt => mỗi tab vẫn có id riêng.
 */
export function getOrCreatePresentationSyncId(scope = 'default'): string {
  if (typeof window === 'undefined') return createPresentationSyncId()
  const safeScope = String(scope || 'default').trim() || 'default'
  const key = `tao-giao-trinh:sync-id:${safeScope}`
  try {
    const existing = window.sessionStorage.getItem(key)?.trim()
    if (existing) return existing
    const next = createPresentationSyncId()
    window.sessionStorage.setItem(key, next)
    return next
  } catch {
    return createPresentationSyncId()
  }
}
