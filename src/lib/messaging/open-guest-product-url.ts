import { isAllowedHttpNavigationUrl } from '@/lib/messaging/widget-parent-bridge'

/** Safari / WebKit trên iPhone, iPod; iPad (kể cả báo desktop). */
function isIosLike(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  if (/iPad|iPhone|iPod/i.test(ua)) return true
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true
  return false
}

function isEmbeddedInFrame(): boolean {
  try {
    return typeof window !== 'undefined' && window.self !== window.top
  } catch {
    return true
  }
}

/** Trang chat mở với `?embed=1` (cùng tab, không iframe) — vẫn là UI nhúng shop. */
function isGuestChatEmbedQueryMode(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const q = new URLSearchParams(window.location.search)
    const ev = (q.get('embed') || '').trim().toLowerCase()
    return ev === '1' || ev === 'true' || ev === 'yes'
  } catch {
    return false
  }
}

function isGuestEmbedNavigationBlocked(): boolean {
  return isEmbeddedInFrame() || isGuestChatEmbedQueryMode()
}

/** Chuẩn hóa URL tuyệt đối (path tương đối trong iframe). */
function resolveNavigationUrl(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  try {
    if (/^https?:\/\//i.test(t)) return t
    return new URL(t, typeof window !== 'undefined' ? window.location.href : 'https://localhost').href
  } catch {
    return null
  }
}

/**
 * Mở liên kết từ cửa sổ chat khách (SP, đơn, URL trong tin, mở full page…).
 *
 * **Nhúng (iframe hoặc `?embed=1`):** không điều hướng sang trang chi tiết sản phẩm — tránh thoát / đổi tab shop.
 *
 * Trang chat đứng một mình:
 * - **iOS**: luôn cùng tab (`assign`).
 * - **Không phải iOS**: màn ≤768px cùng tab; màn rộng tab mới (Android/desktop).
 */
export function openGuestProductDetailUrl(url: string): void {
  if (typeof window === 'undefined') return
  const resolved = resolveNavigationUrl(typeof url === 'string' ? url : '')
  if (!resolved || !isAllowedHttpNavigationUrl(resolved)) return

  if (isGuestEmbedNavigationBlocked()) {
    return
  }

  if (isIosLike()) {
    window.location.assign(resolved)
    return
  }

  const preferSameTab =
    typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 768px)').matches

  if (preferSameTab) {
    window.location.assign(resolved)
    return
  }
  window.open(resolved, '_blank', 'noopener,noreferrer')
}
