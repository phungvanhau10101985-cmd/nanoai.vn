import { NextResponse } from 'next/server'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { buildPartnerPwaIconPng } from '@/lib/partner-website/shop/partner-site-pwa-icon'
import { partnerPwaManifestColor } from '@/lib/partner-website/shop/partner-site-pwa'

export const dynamic = 'force-dynamic'

/** Custom domain `/favicon.ico` — tab trình duyệt. Nguồn: faviconUrl rồi logo shop. */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) {
    return new NextResponse('Not found', { status: 404 })
  }

  const png = await buildPartnerPwaIconPng({
    logoUrl: shop.site.theme.faviconUrl?.trim() || shop.site.logoUrl,
    size: 32,
    backgroundColor: partnerPwaManifestColor(shop.site.theme.backgroundColor, '#ffffff'),
    maskable: false,
  })

  return new NextResponse(new Uint8Array(png), {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
