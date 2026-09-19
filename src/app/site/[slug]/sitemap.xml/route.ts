import { NextRequest, NextResponse } from 'next/server'
import { fetchPartnerInventorySitemapPageFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { loadPartnerShopSitemapAbs } from '@/lib/partner-website/shop/partner-site-sitemap-serve'
import {
  buildPartnerShopSitemapIndexXml,
  countPartnerProductSitemapPages,
  SITEMAP_PAGES_PATH,
  SITEMAP_PRODUCT_PATH_PREFIX,
  SITEMAP_XML_HEADERS,
} from '@/lib/partner-website/shop/partner-site-sitemap'

export const dynamic = 'force-dynamic'

/**
 * Sitemap index — pages tĩnh + N file sản phẩm 5k (giống 188).
 * URL `/sitemap.xml` giữ nguyên để crawler / robots / domain riêng không đổi.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }
  const shop = await loadPartnerShopSitemapAbs(req, slug)
  if (!shop) {
    return new NextResponse('Not found', { status: 404 })
  }
  const first = await fetchPartnerInventorySitemapPageFromPg(shop.partnerId, 1, { skipTotal: false })
  const productPages = countPartnerProductSitemapPages(first?.total ?? 0)
  const xml = buildPartnerShopSitemapIndexXml({
    pagesLoc: shop.abs(SITEMAP_PAGES_PATH),
    productPageLocs: Array.from({ length: productPages }, (_, i) =>
      shop.abs(`${SITEMAP_PRODUCT_PATH_PREFIX}/${i + 1}`)
    ),
  })
  return new NextResponse(xml, { headers: SITEMAP_XML_HEADERS })
}
