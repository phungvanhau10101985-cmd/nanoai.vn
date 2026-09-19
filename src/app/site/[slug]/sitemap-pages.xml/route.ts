import { NextRequest, NextResponse } from 'next/server'
import { isPgConfigured } from '@/lib/db/pool'
import { loadPartnerShopSitemapAbs, partnerShopSitemapPageEntries } from '@/lib/partner-website/shop/partner-site-sitemap-serve'
import { buildPartnerShopUrlsetXml, SITEMAP_XML_HEADERS } from '@/lib/partner-website/shop/partner-site-sitemap'

export const dynamic = 'force-dynamic'

/** Trang tĩnh + danh mục — tách khỏi file sản phẩm 5k. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }
  const shop = await loadPartnerShopSitemapAbs(req, slug)
  if (!shop) {
    return new NextResponse('Not found', { status: 404 })
  }
  const entries = await partnerShopSitemapPageEntries(shop.partnerId, shop.abs)
  return new NextResponse(buildPartnerShopUrlsetXml(entries), { headers: SITEMAP_XML_HEADERS })
}
