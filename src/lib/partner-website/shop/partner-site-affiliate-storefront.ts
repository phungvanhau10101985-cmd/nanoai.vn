import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { loadPartnerSiteShopContext, type PartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import {
  resolveSiteVisitorContext,
  resolveSiteVisitorEmail,
} from '@/lib/partner-website/shop/partner-site-personalization'
import { jsonSitePersonalization } from '@/lib/partner-website/shop/partner-site-personalization-response'
import { resolvePartnerWebsitePublicUrl } from '@/lib/partner-website/resolve-partner-website-public-url'

export { affiliateHasLoggedInIdentity } from '@/lib/partner-website/shop/partner-site-affiliate'

export type PartnerSiteAffiliateStorefrontCtx = {
  shop: PartnerSiteShopContext
  visitor: Awaited<ReturnType<typeof resolveSiteVisitorContext>>
  emailNormalized: string | null
  origin: string
  identity: {
    partnerId: string
    guestAccountId: string | null
    linkedUserId: string | null
    emailNormalized: string | null
  }
}

export async function loadPartnerSiteAffiliateStorefront(
  request: NextRequest,
  slug: string
): Promise<PartnerSiteAffiliateStorefrontCtx | null> {
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return null
  const visitor = await resolveSiteVisitorContext(request, shop.partnerId)
  const emailNormalized = await resolveSiteVisitorEmail(request, shop.partnerId, visitor.thread)
  const origin =
    (await resolvePartnerWebsitePublicUrl({
      partnerId: shop.partnerId,
      siteSlug: shop.site.siteSlug,
      isPublished: Boolean(shop.site.isPublished),
      req: request,
    })) || request.nextUrl.origin
  return {
    shop,
    visitor,
    emailNormalized,
    origin: origin.replace(/\/$/, ''),
    identity: {
      partnerId: shop.partnerId,
      guestAccountId: visitor.thread.guestAccountId,
      linkedUserId: visitor.thread.linkedUserId,
      emailNormalized,
    },
  }
}

export function affiliateHasStorefrontIdentity(store: PartnerSiteAffiliateStorefrontCtx): boolean {
  return Boolean(store.identity.guestAccountId || store.identity.linkedUserId)
}

export function jsonAffiliateStorefront(
  request: NextRequest,
  store: PartnerSiteAffiliateStorefrontCtx,
  body: unknown,
  status = 200
) {
  return jsonSitePersonalization(request, body, status, {
    sessionId: store.visitor.sessionId,
    thread: store.visitor.thread,
  })
}

export function jsonAffiliateError(
  request: NextRequest,
  store: PartnerSiteAffiliateStorefrontCtx,
  error: unknown,
  fallback = 'error'
) {
  const code = error instanceof Error ? error.message : fallback
  const status = code === 'AUTH_REQUIRED' ? 401 : code === 'NOT_APPROVED' ? 403 : 400
  return jsonAffiliateStorefront(request, store, { ok: false, error: code }, status)
}

export function jsonAffiliateNotFound() {
  return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
}
