import { NextRequest, NextResponse } from 'next/server'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import {
  resolveSiteVisitorContext,
  resolveSiteVisitorEmail,
} from '@/lib/partner-website/shop/partner-site-personalization'
import { jsonSitePersonalization } from '@/lib/partner-website/shop/partner-site-personalization-response'

const ADDRESS_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isPartnerSiteAddressId(value: string): boolean {
  return ADDRESS_ID_RE.test(value.trim())
}

export async function resolveSiteAddressBookAuth(request: NextRequest, slug: string) {
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) {
    return { ok: false as const, error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  }
  const visitor = await resolveSiteVisitorContext(request, shop.partnerId)
  const email = await resolveSiteVisitorEmail(request, shop.partnerId, visitor.thread)
  if (!email) {
    return {
      ok: false as const,
      error: jsonSitePersonalization(
        request,
        { ok: false, error: 'AUTH_REQUIRED', requireAuth: true },
        401,
        { sessionId: visitor.sessionId, thread: visitor.thread }
      ),
    }
  }
  return { ok: true as const, shop, visitor, email }
}
