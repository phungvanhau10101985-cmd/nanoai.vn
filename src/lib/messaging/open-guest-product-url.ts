import {
  NANOAI_WIDGET_MSG_SOURCE,
  isAllowedHttpNavigationUrl,
  isDashboardNavigationUrl,
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
 * Mở liên kết từ cửa sổ chat khách (SP, đơn, URL trong tin, mở full page…).
 *
 * **Nhúng iframe (site shop → chat):** ưu tiên thay **cả tab trình duyệt** (trang host lúc mở chat),
 * không chỉ document trong iframe — cùng origin dùng `top`; khác origin gửi `postMessage` tới
 * `FloatingChatWidget`.
 *
 * Trang chat đứng một mình:
 * - **iOS**: luôn cùng tab (`assign`).
 * - **Không phải iOS**: màn ≤768px cùng tab; màn rộng tab mới (Android/desktop).
 */
export function openGuestProductDetailUrl(url: string): void {
  if (typeof window === 'undefined') return
  const resolved = resolveNavigationUrl(typeof url === 'string' ? url : '')
  if (!resolved || !isAllowedHttpNavigationUrl(resolved) || isDashboardNavigationUrl(resolved)) return

  if (isEmbeddedInFrame()) {
    let sameOriginTop = false
    let topIsDashboard = false
    try {
      const path = window.top?.location?.pathname || ''
      sameOriginTop = true
      topIsDashboard = path === '/dashboard' || path.startsWith('/dashboard/')
    } catch {
      sameOriginTop = false
    }
    // Preview trong trang quản trị: top là dashboard. Gán top sẽ thay cả tab quản trị.
    if (sameOriginTop && topIsDashboard) {
      const parent = window.parent
      if (parent && parent !== window) {
        try {
          parent.location.assign(resolved)
          return
        } catch {
          /* parent cross-origin */
        }
      }
      window.location.assign(resolved)
      return
    }
    if (sameOriginTop) {
      try {
        window.top!.location.assign(resolved)
        return
      } catch {
        /* ignore */
      }
    }
    try {
      window.parent.postMessage(
        { source: NANOAI_WIDGET_MSG_SOURCE, type: 'NAVIGATE_TOP', url: resolved },
        '*'
      )
    } catch {
      /* ignore */
    }
    window.setTimeout(() => {
      try {
        window.location.assign(resolved)
      } catch {
        /* ignore */
      }
    }, 400)
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
