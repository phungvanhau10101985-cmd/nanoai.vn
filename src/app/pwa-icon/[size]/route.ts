import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { readPartnerCustomDomainFromHeaders } from '@/lib/auth/app-request-headers'
import { resolveActivePartnerCustomDomainByHostPg } from '@/lib/db/messaging-partner-custom-domains-pg'
import { isPlatformAppHostname } from '@/lib/messaging/partner-custom-domain-platform-host'
import { loadPartnerShopLiveBrandIconUrls } from '@/lib/partner-website/promotions/partner-sale-icon-live'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import {
  PARTNER_PWA_ICON_SIZES,
  type PartnerPwaIconSize,
} from '@/lib/partner-website/shop/partner-site-pwa'
import {
  buildPartnerPwaIconPng,
  partnerShopIconFallbackLetter,
} from '@/lib/partner-website/shop/partner-site-pwa-icon'
import { shopBrowserChromeColor } from '@/lib/partner-website/template/partner-website-theme-tokens'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, ctx: { params: Promise<{ size: string }> }) {
  const { size: sizeRaw } = await ctx.params
  const cleanSize = sizeRaw.replace(/\.png$/i, '')
  const sizeNum = Number(cleanSize)
  if (!PARTNER_PWA_ICON_SIZES.includes(sizeNum as PartnerPwaIconSize)) {
    return new NextResponse('Invalid icon size', { status: 400 })
  }
  const size = sizeNum as PartnerPwaIconSize

  const headerStore = headers()
  const customHost =
    readPartnerCustomDomainFromHeaders((name) => headerStore.get(name)) ||
    headerStore.get('x-forwarded-host')?.split(',')[0]?.trim().toLowerCase().split(':')[0] ||
    headerStore.get('host')?.split(',')[0]?.trim().toLowerCase().split(':')[0] ||
    ''

  if (customHost && !isPlatformAppHostname(customHost)) {
    const row = await resolveActivePartnerCustomDomainByHostPg(customHost).catch(() => null)
    const siteSlug = row?.site_slug?.trim() || ''
    if (siteSlug && row?.use_for_site !== false && row?.site_published) {
      const shop = await loadPartnerSiteShopContext(siteSlug).catch(() => null)
      if (shop) {
        const url = new URL(req.url)
        const maskable = url.searchParams.get('maskable') === '1'
        const png = await buildPartnerPwaIconPng({
          logoUrls: await loadPartnerShopLiveBrandIconUrls({
            partnerId: shop.partnerId,
            theme: shop.site.theme,
            logoUrl: shop.site.logoUrl,
          }),
          size,
          backgroundColor: shopBrowserChromeColor(shop.site.theme),
          maskable,
          fallbackLetter: partnerShopIconFallbackLetter(shop.site.title || shop.site.partnerDisplayName),
        })

        return new NextResponse(new Uint8Array(png), {
          status: 200,
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=86400, must-revalidate',
          },
        })
      }
    }
  }

  const url = new URL('/meta/nanoai-app-icon-512.png', req.url)
  return NextResponse.redirect(url, 307)
}
