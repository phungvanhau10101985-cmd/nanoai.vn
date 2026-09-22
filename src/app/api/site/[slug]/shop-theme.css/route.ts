import { NextResponse } from 'next/server'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import {
  buildPartnerShopLiveCssPack,
  partnerShopLiveCssVersion,
} from '@/lib/partner-website/shop/partner-shop-live-css'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return new NextResponse('Not found', { status: 404, headers: { 'Content-Type': 'text/plain' } })

  const version = partnerShopLiveCssVersion(shop.site.theme)
  const etag = `"${version}"`
  if (request.headers.get('if-none-match') === etag) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag } })
  }

  const requested = new URL(request.url).searchParams.get('v') || ''
  const immutable = requested === version
  const css = buildPartnerShopLiveCssPack(shop.site.theme)
  return new NextResponse(css, {
    status: 200,
    headers: {
      'Content-Type': 'text/css; charset=utf-8',
      ETag: etag,
      'Cache-Control': immutable
        ? 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800'
        : 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400',
    },
  })
}
