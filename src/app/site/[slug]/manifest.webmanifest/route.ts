import { NextResponse } from 'next/server'
import { PARTNER_CUSTOM_DOMAIN_HEADER } from '@/lib/auth/app-request-headers'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { partnerSiteHomePath } from '@/lib/partner-website/shop/partner-site-shop-paths'

export const dynamic = 'force-dynamic'

function manifestColor(value: unknown, fallback: string): string {
  const color = typeof value === 'string' ? value.trim() : ''
  return /^#[0-9a-f]{3,8}$/i.test(color) ? color : fallback
}

/** W5.5 — per-shop PWA manifest (name + logo). */
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const name = shop.site.title.trim() || shop.site.partnerDisplayName || 'Shop'
  const customDomain = Boolean(req.headers.get(PARTNER_CUSTOM_DOMAIN_HEADER)?.trim())
  const homePath = partnerSiteHomePath(shop.site.siteSlug, { customDomain })
  // The platform tenant scope needs a trailing slash so the worker controls
  // the launch navigation too. A custom-domain shop already starts at `/`.
  const startUrl = customDomain || homePath.endsWith('/') ? homePath : `${homePath}/`
  const icons = shop.site.logoUrl
    ? [
        {
          src: shop.site.logoUrl,
          sizes: '192x192',
          purpose: 'any',
        },
        {
          src: shop.site.logoUrl,
          sizes: '512x512',
          purpose: 'any maskable',
        },
      ]
    : [
        {
          src: '/icons/icon-192x192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: '/icons/icon-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable',
        },
      ]

  const manifest = {
    name,
    short_name: name.slice(0, 24),
    description: shop.site.partnerDisplayName || name,
    id: startUrl,
    start_url: startUrl,
    scope: startUrl.endsWith('/') ? startUrl : `${startUrl}/`,
    display: 'standalone',
    background_color: manifestColor(shop.site.theme.backgroundColor, '#ffffff'),
    theme_color: manifestColor(shop.site.theme.primaryColor, '#111827'),
    icons,
  }

  return new NextResponse(JSON.stringify(manifest), {
    status: 200,
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
