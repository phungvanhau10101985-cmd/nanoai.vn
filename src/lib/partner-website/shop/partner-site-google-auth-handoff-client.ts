/**
 * Client-safe helpers for Google shop auth handoff.
 * Do not import the server handoff module from Client Components (it pulls in `pg`).
 */

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
