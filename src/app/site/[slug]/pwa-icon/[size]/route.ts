import { NextResponse } from 'next/server'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import {
  loadPartnerShopLiveBrandIconUrls,
  loadPartnerShopLiveBrandTheme,
} from '@/lib/partner-website/promotions/partner-sale-icon-live'
import {
  buildPartnerPwaIconPng,
  partnerShopIconFallbackLetter,
} from '@/lib/partner-website/shop/partner-site-pwa-icon'
import { isPartnerPwaIconSize, type PartnerPwaIconSize } from '@/lib/partner-website/shop/partner-site-pwa'
import { shopBrowserChromeColor } from '@/lib/partner-website/template/partner-website-theme-tokens'

export const dynamic = 'force-dynamic'

/** W5.5 — exact-size PNG icons so Chrome can install each shop as its own app.
 * `backgroundColor` only tints the letter fallback; canvas is transparent (any) or white (maskable).
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ slug: string; size: string }> }
) {
  const { slug, size: sizeRaw } = await ctx.params
  const cleanSizeRaw = (sizeRaw || '').replace(/\.png$/i, '').trim()
  if (!isPartnerPwaIconSize(cleanSizeRaw)) {
    return new NextResponse('Not found', { status: 404 })
  }
  const size = Number(cleanSizeRaw) as PartnerPwaIconSize
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) {
    return new NextResponse('Not found', { status: 404 })
  }

  const live = await loadPartnerShopLiveBrandTheme({
    partnerId: shop.partnerId,
    theme: shop.site.theme,
  })
  const purpose = new URL(req.url).searchParams.get('purpose')?.trim().toLowerCase()
  const png = await buildPartnerPwaIconPng({
    logoUrls: await loadPartnerShopLiveBrandIconUrls({
      partnerId: shop.partnerId,
      theme: shop.site.theme,
      logoUrl: shop.site.logoUrl,
    }),
    size,
    backgroundColor: shopBrowserChromeColor(shop.site.theme),
    maskable: purpose === 'maskable',
    fallbackLetter: partnerShopIconFallbackLetter(shop.site.title || shop.site.partnerDisplayName),
  })

  const shortCache = Boolean(live.saleIconUrl) || size <= 32
  return new NextResponse(new Uint8Array(png), {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': shortCache
        ? 'public, max-age=60, must-revalidate'
        : 'public, max-age=3600, must-revalidate',
    },
  })
}
