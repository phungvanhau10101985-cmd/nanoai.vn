/** Skip auto re-login on shop after explicit sign-out (platform email session still active). */

export const PARTNER_SITE_SHOP_SKIP_AUTH_SYNC_HEADER = 'x-pw-shop-skip-auth-sync'

export function partnerSiteShopSkipAuthSyncKey(siteSlug: string): string {
  return `pw_shop_skip_auth_sync_${siteSlug.trim()}`
}

export function markPartnerSiteShopSkipAuthSync(siteSlug: string): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(partnerSiteShopSkipAuthSyncKey(siteSlug), '1')
  } catch {
    /* ignore */
  }
}

export function shouldPartnerSiteShopSkipAuthSync(siteSlug: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return sessionStorage.getItem(partnerSiteShopSkipAuthSyncKey(siteSlug)) === '1'
  } catch {
    return false
  }
}

export function clearPartnerSiteShopSkipAuthSync(siteSlug: string): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(partnerSiteShopSkipAuthSyncKey(siteSlug))
  } catch {
    /* ignore */
  }
}

/** Request asked shop to stay signed out despite NanoAI platform session. */
export function requestSkipsPartnerSiteShopAuthResume(request: {
  headers: { get(name: string): string | null }
}): boolean {
  return request.headers.get(PARTNER_SITE_SHOP_SKIP_AUTH_SYNC_HEADER)?.trim() === '1'
}
