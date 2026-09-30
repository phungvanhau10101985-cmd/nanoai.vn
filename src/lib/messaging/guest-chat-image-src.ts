/** Path object Bunny của ảnh chat (`messaging-guest|partner/{partnerId}/file`). */
export function messagingStoragePathFromUrl(url: string): string | null {
  const t = url.trim()
  if (!t) return null
  const bare = t.split('?')[0]?.split('#')[0] ?? ''
  if (bare.startsWith('messaging-guest/') || bare.startsWith('messaging-partner/')) {
    return bare.includes('..') ? null : bare
  }
  try {
    const u = new URL(t)
    const path = decodeURIComponent(u.pathname.replace(/^\/+/, ''))
    if (path.includes('..')) return null
    if (path.startsWith('messaging-guest/') || path.startsWith('messaging-partner/')) return path
  } catch {
    return null
  }
  return null
}

/**
 * Ảnh khách gửi shop nằm trên `*.b-cdn.net` — nhiều mạng điện thoại không phân giải host đó.
 * Trang chat tải cùng origin, server đọc Storage API (cùng PUT với upload).
 */
export function guestChatSameOriginImageSrc(url: string): string | null {
  const path = messagingStoragePathFromUrl(url)
  if (!path) return null
  return `/api/messaging/chat-image?path=${encodeURIComponent(path)}`
}

export function browserCanPreviewChatImage(file: { type: string }): boolean {
  const t = (file.type || '').split(';')[0].trim().toLowerCase()
  return t === 'image/jpeg' || t === 'image/png' || t === 'image/gif' || t === 'image/webp'
}
