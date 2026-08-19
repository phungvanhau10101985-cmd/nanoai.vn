import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import {
  buildGoogleOAuthAuthorizeUrl,
  GOOGLE_OAUTH_STATE_COOKIE,
  isGoogleOAuthEnabled,
} from '@/lib/auth/google-oauth-config'
import { getGoogleOAuthStateCookieOptions } from '@/lib/auth/google-oauth-state-cookie'
import { isEmailAuthEnabled } from '@/lib/auth/email-auth-config'
import { getPublicAppUrlForServer } from '@/lib/auth/public-app-url'
import { sanitizeLoginNext } from '@/lib/auth/sanitize-login-next'
import { extractPathSlugFromLoginNext } from '@/lib/auth/signup-source'
import { isPlatformAppHostname } from '@/lib/messaging/partner-custom-domain-platform-host'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { resolveVerifiedPartnerShopReturnUrlForSite } from '@/lib/partner-website/shop/partner-site-google-auth-handoff'
import { partnerSiteAccountPath } from '@/lib/partner-website/shop/partner-site-shop-paths'

export const dynamic = 'force-dynamic'

/**
 * Bridge: domain khách → NanoAI → Google OAuth.
 * Cookie state gắn trên host NanoAI (không phải domain khách), nên Google chỉ cần
 * đăng ký redirect URI của NanoAI.
 *
 * Query:
 * - site: siteSlug
 * - return: absolute URL trên domain khách đã verify
 * - next: path nội bộ /site/{slug}/… (tuỳ chọn)
 */
export async function GET(req: NextRequest) {
  const platformOrigin = getPublicAppUrlForServer(req).replace(/\/$/, '')
  const fail = (code: string) =>
    NextResponse.redirect(`${platformOrigin}/auth/login?error=${encodeURIComponent(code)}`)

  if (!isEmailAuthEnabled() || !isGoogleOAuthEnabled()) {
    return fail('google_auth_disabled')
  }

  const siteSlug = req.nextUrl.searchParams.get('site')?.trim().toLowerCase() || ''
  const shopReturnRaw = req.nextUrl.searchParams.get('return')?.trim() || ''
  const nextRaw = req.nextUrl.searchParams.get('next')?.trim() || ''

  if (!siteSlug || !shopReturnRaw) {
    return fail('google_oauth_failed')
  }

  const shop = await loadPartnerSiteShopContext(siteSlug)
  if (!shop) return fail('google_oauth_failed')

  const verified = await resolveVerifiedPartnerShopReturnUrlForSite({
    rawReturnUrl: shopReturnRaw,
    siteSlug: shop.site.siteSlug,
    partnerId: shop.partnerId,
  })
  if (!verified) return fail('google_oauth_failed')

  let next = sanitizeLoginNext(nextRaw)
  const extracted = extractPathSlugFromLoginNext(next)
  if (!extracted || extracted.kind !== 'site' || extracted.slug !== shop.site.siteSlug) {
    next = partnerSiteAccountPath(shop.site.siteSlug)
  }

  // OAuth callback must stay on NanoAI platform host — never the shop custom domain.
  const redirectUri = `${platformOrigin}/auth/callback`
  const state = randomBytes(24).toString('hex')
  const authUrl = buildGoogleOAuthAuthorizeUrl({ redirectUri, state })

  const res = NextResponse.redirect(authUrl)
  res.cookies.set(
    GOOGLE_OAUTH_STATE_COOKIE,
    JSON.stringify({
      state,
      next,
      redirectUri,
      shopReturnUrl: verified.href,
    }),
    getGoogleOAuthStateCookieOptions()
  )
  return res
}

/** Guard for tests / docs — bridge must not treat shop host as OAuth redirect origin. */
export function assertShopGoogleBridgeUsesPlatformHost(hostname: string): boolean {
  return isPlatformAppHostname(hostname)
}
