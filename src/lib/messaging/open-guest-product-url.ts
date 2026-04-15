import {
  NANOAI_WIDGET_MSG_SOURCE,
  isAllowedHttpNavigationUrl,
} from '@/lib/messaging/widget-parent-bridge'

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
 * Trong iframe chat: mở SP trên **tab trang shop** (top / postMessage), không `assign` trong iframe —
 * nếu assign trong iframe thì SP thay thế UI chat, không nút quay lại và mở chat lại dễ lồng khung.
 */
function openProductUrlFromEmbedIframe(resolved: string): void {
  const returnChatUrl =
    typeof window.location.href === 'string' ? window.location.href.trim() : ''

  try {
    if (window.top && window.top !== window.self) {
      window.top.location.assign(resolved)
      return
    }
  } catch {
    /* cross-origin: không đọc được top */
  }

  try {
    window.parent.postMessage(
      {
        source: NANOAI_WIDGET_MSG_SOURCE,
        type: 'NAVIGATE_TOP',
        url: resolved,
        ...(returnChatUrl ? { returnChatUrl } : {}),
      },
      '*'
    )
  } catch {
    /* ignore */
  }
}

/**
 * Mở liên kết từ cửa sổ chat khách (SP, đơn, URL trong tin, mở full page…).
 *
 * **iframe:** điều hướng **cửa sổ cha / top** (đồng bộ với `FloatingChatWidget` / `nanoai-chat-widget.js`).
 *
 * Trang chat đứng một mình:
 * - **iOS**: luôn cùng tab (`assign`).
 * - **Không phải iOS**: màn ≤768px cùng tab; màn rộng tab mới (Android/desktop).
 */
export function openGuestProductDetailUrl(url: string): void {
  if (typeof window === 'undefined') return
  const resolved = resolveNavigationUrl(typeof url === 'string' ? url : '')
  if (!resolved || !isAllowedHttpNavigationUrl(resolved)) return

  if (isEmbeddedInFrame()) {
    openProductUrlFromEmbedIframe(resolved)
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
