import {
  pickMetaAdvancedMatching,
  PLATFORM_META_AM_STORAGE_KEY,
  partnerSiteMetaMatchingParams,
  type PartnerSiteMetaAdvancedMatching,
} from '@/lib/partner-website/shop/partner-site-meta-advanced-matching'

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
    __nanoPlatformMetaPixelId?: string
    __nanoPlatformMetaAm?: Record<string, string>
  }
}

function readStored(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    return pickMetaAdvancedMatching(
      JSON.parse(window.localStorage.getItem(PLATFORM_META_AM_STORAGE_KEY) || 'null') as Record<string, unknown> | null
    )
  } catch {
    return {}
  }
}

function pushToPixel(matching: Record<string, string>): void {
  if (typeof window === 'undefined' || !Object.keys(matching).length) return
  window.__nanoPlatformMetaAm = matching
  const pixelId = String(window.__nanoPlatformMetaPixelId || '').trim()
  if (!pixelId || typeof window.fbq !== 'function') return
  window.fbq('init', pixelId, matching)
}

/** Nhớ dữ liệu khách đã chuẩn hoá rồi cập nhật `fbq('init')` nếu pixel đã chạy. */
export function rememberPlatformMetaCustomer(src: PartnerSiteMetaAdvancedMatching): Record<string, string> {
  const params = partnerSiteMetaMatchingParams(src)
  if (!Object.keys(params).length) return readStored()
  const next = { ...readStored(), ...params }
  try {
    window.localStorage.setItem(PLATFORM_META_AM_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // private mode
  }
  pushToPixel(next)
  return next
}

export function clearPlatformMetaAdvancedMatching(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(PLATFORM_META_AM_STORAGE_KEY)
  } catch {
    // private mode
  }
  window.__nanoPlatformMetaAm = {}
}

/** Đọc phiên đăng nhập rồi ghi so khớp nâng cao trước sự kiện tiếp theo. */
export async function syncPlatformMetaAdvancedMatching(): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    const res = await fetch('/api/auth/me', {
      credentials: 'same-origin',
      signal: AbortSignal.timeout(2000),
    })
    if (!res.ok) return
    const data = (await res.json()) as {
      user?: {
        id?: string
        email?: string
        fullName?: string
        gender?: string
        birthDate?: string
        phone?: string
      } | null
    }
    const user = data.user
    if (!user?.id && !user?.email) return
    rememberPlatformMetaCustomer({
      email: user.email,
      fullName: user.fullName,
      gender: user.gender,
      dateOfBirth: user.birthDate,
      phone: user.phone,
      externalId: user.id,
    })
  } catch {
    // pixel vẫn chạy; lần sau đọc localStorage nếu đã có
  }
}
