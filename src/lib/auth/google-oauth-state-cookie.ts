import { GOOGLE_OAUTH_STATE_COOKIE } from '@/lib/auth/google-oauth-config'
import { getEmailSessionCookieOptions } from '@/lib/auth/email-session-token'

export type GoogleOAuthStatePayload = {
  state: string
  next: string
  redirectUri: string
  /** Absolute URL on verified partner shop domain — after Google, handoff back with pw_auth. */
  shopReturnUrl?: string | null
}

export function getGoogleOAuthStateCookieOptions() {
  const base = getEmailSessionCookieOptions()
  return {
    ...base,
    maxAge: 600,
  }
}

export function parseGoogleOAuthStateCookie(raw: string | undefined | null): GoogleOAuthStatePayload | null {
  if (!raw?.trim()) return null
  try {
    const parsed = JSON.parse(raw) as Partial<GoogleOAuthStatePayload>
    const state = String(parsed.state || '').trim()
    const next = String(parsed.next || '/').trim() || '/'
    const redirectUri = String(parsed.redirectUri || '').trim()
    const shopReturnUrl = String(parsed.shopReturnUrl || '').trim() || null
    if (!state) return null
    return { state, next, redirectUri, shopReturnUrl }
  } catch {
    return null
  }
}

export function setGoogleOAuthStateCookie(
  res: { cookies: { set: (name: string, value: string, options: Record<string, unknown>) => void } },
  payload: GoogleOAuthStatePayload
) {
  res.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, JSON.stringify(payload), getGoogleOAuthStateCookieOptions())
}

export function clearGoogleOAuthStateCookie(
  res: { cookies: { set: (name: string, value: string, options: Record<string, unknown>) => void } }
) {
  res.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, '', { path: '/', maxAge: 0 })
}
