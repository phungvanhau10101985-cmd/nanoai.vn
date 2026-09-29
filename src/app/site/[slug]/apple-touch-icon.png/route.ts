import { NextResponse } from 'next/server'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { loadPartnerShopLiveBrandIconUrls } from '@/lib/partner-website/promotions/partner-sale-icon-live'
import {
  buildPartnerPwaIconPng,
  partnerShopIconFallbackLetter,
} from '@/lib/partner-website/shop/partner-site-pwa-icon'
import { shopBrowserChromeColor } from '@/lib/partner-website/template/partner-website-theme-tokens'

export const dynamic = 'force-dynamic'

/**
 * Route phục vụ `/site/[slug]/apple-touch-icon.png` (size 180 cho iOS/iPadOS)
 * Đảm bảo crawler & thiết bị Apple lấy đúng icon của shop, không bao giờ rơi về NanoAI.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) {
    return new NextResponse('Not found', { status: 404 })
  }

  const png = await buildPartnerPwaIconPng({
    logoUrls: await loadPartnerShopLiveBrandIconUrls({
      partnerId: shop.partnerId,
      theme: shop.site.theme,
      logoUrl: shop.site.logoUrl,
    }),
    size: 180,
    backgroundColor: shopBrowserChromeColor(shop.site.theme),
    maskable: false,
    fallbackLetter: partnerShopIconFallbackLetter(shop.site.title || shop.site.partnerDisplayName),
  })

  return new NextResponse(new Uint8Array(png), {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=3600, must-revalidate',
    },
  })
}
