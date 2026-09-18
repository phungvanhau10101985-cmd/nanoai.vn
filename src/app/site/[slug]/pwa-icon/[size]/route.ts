import { NextResponse } from 'next/server'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import {
  buildPartnerPwaIconPng,
  partnerShopBrandIconUrls,
  partnerShopIconFallbackLetter,
} from '@/lib/partner-website/shop/partner-site-pwa-icon'
import { isPartnerPwaIconSize, type PartnerPwaIconSize } from '@/lib/partner-website/shop/partner-site-pwa'
import { shopBrowserChromeColor } from '@/lib/partner-website/template/partner-website-theme-tokens'

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
    logoUrls: partnerShopBrandIconUrls({
      faviconUrl: shop.site.theme.faviconUrl,
      logoUrl: shop.site.logoUrl,
    }),
    size,
    backgroundColor: shopBrowserChromeColor(shop.site.theme),
    maskable: purpose === 'maskable',
    fallbackLetter: partnerShopIconFallbackLetter(shop.site.title || shop.site.partnerDisplayName),
  })

  return new NextResponse(new Uint8Array(png), {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': size <= 32 ? 'public, max-age=60, must-revalidate' : 'public, max-age=3600',
    },
  })
}
