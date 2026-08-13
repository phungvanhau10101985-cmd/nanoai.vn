import { NextResponse } from 'next/server'
import { PARTNER_CUSTOM_DOMAIN_HEADER } from '@/lib/auth/app-request-headers'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { buildPartnerPwaIconPng } from '@/lib/partner-website/shop/partner-site-pwa-icon'
import {
  isPartnerPwaIconSize,
  partnerPwaManifestColor,
  type PartnerPwaIconSize,
} from '@/lib/partner-website/shop/partner-site-pwa'

export const dynamic = 'force-dynamic'

/** W5.5 — exact-size PNG icons so Chrome can install each shop as its own app. */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ slug: string; size: string }> }
) {
  const { slug, size: sizeRaw } = await ctx.params
  if (!isPartnerPwaIconSize(sizeRaw)) {
    return new NextResponse('Not found', { status: 404 })
  }
  const size = Number(sizeRaw) as PartnerPwaIconSize
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) {
    return new NextResponse('Not found', { status: 404 })
  }

  const purpose = new URL(req.url).searchParams.get('purpose')?.trim().toLowerCase()
  const png = await buildPartnerPwaIconPng({
    logoUrl: shop.site.logoUrl,
    size,
    backgroundColor: partnerPwaManifestColor(shop.site.theme.backgroundColor, '#ffffff'),
    maskable: purpose === 'maskable',
  })

  return new NextResponse(new Uint8Array(png), {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
