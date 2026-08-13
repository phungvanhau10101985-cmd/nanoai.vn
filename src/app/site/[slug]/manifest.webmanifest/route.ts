import { NextResponse } from 'next/server'
import { PARTNER_CUSTOM_DOMAIN_HEADER } from '@/lib/auth/app-request-headers'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { buildPartnerShopWebManifest } from '@/lib/partner-website/shop/partner-site-pwa'

export const dynamic = 'force-dynamic'

/** W5.5 — per-shop PWA manifest (name + generated PNG icons). */
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const customDomain = Boolean(req.headers.get(PARTNER_CUSTOM_DOMAIN_HEADER)?.trim())
  const name = shop.site.title.trim() || shop.site.partnerDisplayName || 'Shop'
  const manifest = buildPartnerShopWebManifest({
    siteSlug: shop.site.siteSlug,
    name,
    description: shop.site.partnerDisplayName || name,
    customDomain,
    backgroundColor: shop.site.theme.backgroundColor,
    themeColor: shop.site.theme.primaryColor,
    locale: shop.site.locale,
  })

  return new NextResponse(JSON.stringify(manifest), {
    status: 200,
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
