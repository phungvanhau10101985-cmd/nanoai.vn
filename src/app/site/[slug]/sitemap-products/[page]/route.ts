import { NextRequest, NextResponse } from 'next/server'
import { fetchPartnerInventorySitemapPageFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { buildPartnerSiteProductKey } from '@/lib/partner-website/shop/partner-site-product-slug'
import { loadPartnerShopSitemapAbs } from '@/lib/partner-website/shop/partner-site-sitemap-serve'
import {
  buildPartnerShopUrlsetXml,
  clampPartnerSitemapProductPage,
  sitemapUrlEntry,
  SITEMAP_XML_HEADERS,
} from '@/lib/partner-website/shop/partner-site-sitemap'

export const dynamic = 'force-dynamic'

/** Một trang ≤ 5000 URL sản phẩm. Trang 2+ bỏ COUNT (skip_total). */
export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string; page: string }> }) {
  const { slug, page: pageRaw } = await ctx.params
  const page = clampPartnerSitemapProductPage(Number(pageRaw))
  if (!page) {
    return new NextResponse('Not found', { status: 404 })
  }
  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }
  const shop = await loadPartnerShopSitemapAbs(req, slug)
  if (!shop) {
    return new NextResponse('Not found', { status: 404 })
  }
  const result = await fetchPartnerInventorySitemapPageFromPg(shop.partnerId, page, { skipTotal: page > 1 })
  const entries = (result?.rows ?? []).map((p) => {
    const key = buildPartnerSiteProductKey(p.name, p.id)
    return sitemapUrlEntry(shop.abs(`/products/${key}`), p.updatedAt || undefined)
  })
  return new NextResponse(buildPartnerShopUrlsetXml(entries), { headers: SITEMAP_XML_HEADERS })
}
