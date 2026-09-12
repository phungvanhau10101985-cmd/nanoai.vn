/**
 * Client-safe helpers for Google shop auth handoff.
 * Do not import the server handoff module from Client Components (it pulls in `pg`).
 */

import {
  MESSAGING_GUEST_ACCOUNT_HEADER,
  MESSAGING_GUEST_ACCOUNT_STORAGE_KEY,
  MESSAGING_GUEST_ACCOUNT_STORAGE_KEY_LEGACY,
} from '@/lib/messaging/guest-account-session'
import {
  MESSAGING_GUEST_SESSION_HEADER,
  MESSAGING_GUEST_SESSION_STORAGE_KEY,
  MESSAGING_GUEST_SESSION_STORAGE_KEY_LEGACY,
} from '@/lib/messaging/guest-auth-session'

/** Query trên domain khách sau Google OAuth (NanoAI → shop). */
export const PARTNER_SITE_GOOGLE_AUTH_HANDOFF_QUERY_KEY = 'pw_auth'

export function buildShopGoogleAuthBridgeUrl(input: {
  platformOrigin: string
  siteSlug: string
  /** Absolute URL on customer domain to return to. */
  shopReturnUrl: string
  /** Internal next path after login on platform, e.g. `/site/{slug}/account`. */
  nextPath: string
}): string {
  const base = input.platformOrigin.replace(/\/$/, '')
  const u = new URL(`${base}/auth/shop-google`)
  u.searchParams.set('site', input.siteSlug.trim())
  u.searchParams.set('return', input.shopReturnUrl.trim())
  u.searchParams.set('next', input.nextPath.trim() || `/site/${encodeURIComponent(input.siteSlug)}/account`)
  return u.toString()
}

type HandoffWindow = Window & { __pwAuthHandoffDone?: boolean }

/** Đổi `?pw_auth=` → cookie guest trên domain đang mở. Gọi một lần trên mọi trang shop. */
export async function consumePartnerSiteGoogleAuthHandoffFromWindow(input: {
  siteSlug: string
  authHeaders?: () => Record<string, string>
  captureFromResponse?: (res: Response) => void
}): Promise<boolean> {
  if (typeof window === 'undefined') return false
  const win = window as HandoffWindow
  if (win.__pwAuthHandoffDone) return false
  const sp = new URLSearchParams(window.location.search)
  const token = sp.get(PARTNER_SITE_GOOGLE_AUTH_HANDOFF_QUERY_KEY)?.trim() ?? ''
  if (!token) return false
  win.__pwAuthHandoffDone = true
  try {
    const res = await fetch(`/api/site/${encodeURIComponent(input.siteSlug.trim())}/auth/handoff`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(input.authHeaders?.() || {}) },
      body: JSON.stringify({ token }),
    })
    input.captureFromResponse?.(res)
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; accountId?: string }
    const sid = res.headers.get(MESSAGING_GUEST_SESSION_HEADER)?.trim() ?? ''
    const aid = (res.headers.get(MESSAGING_GUEST_ACCOUNT_HEADER)?.trim() || json.accountId || '').trim()
    try {
      if (sid) {
        window.localStorage.setItem(MESSAGING_GUEST_SESSION_STORAGE_KEY, sid)
        window.localStorage.setItem(MESSAGING_GUEST_SESSION_STORAGE_KEY_LEGACY, sid)
      }
      if (aid) {
        window.localStorage.setItem(MESSAGING_GUEST_ACCOUNT_STORAGE_KEY, aid)
        window.localStorage.setItem(MESSAGING_GUEST_ACCOUNT_STORAGE_KEY_LEGACY, aid)
        window.dispatchEvent(
          new CustomEvent('pw-partner-site-guest-session-change', {
            detail: { siteSlug: input.siteSlug.trim().toLowerCase() },
          })
        )
      }
    } catch {
      /* ignore */
    }
    sp.delete(PARTNER_SITE_GOOGLE_AUTH_HANDOFF_QUERY_KEY)
    sp.delete('meta_complete_registration')
    const nextPath = `${window.location.pathname}${sp.toString() ? `?${sp.toString()}` : ''}${window.location.hash || ''}`
    window.history.replaceState(null, '', nextPath)
    return Boolean(res.ok && json.ok)
  } catch {
    win.__pwAuthHandoffDone = false
    return false
  }
}
