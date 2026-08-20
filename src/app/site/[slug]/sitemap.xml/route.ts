import { NextRequest, NextResponse } from 'next/server'
import { fetchPartnerCategoriesFlatFromPg } from '@/lib/db/messaging-partner-categories-pg'
import { fetchPartnerInventoryFullListOrderedCreatedFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import { fetchPartnerWebsiteByPartnerIdPg } from '@/lib/db/messaging-partner-websites-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { readPartnerCustomDomainFromHeaders } from '@/lib/auth/app-request-headers'
import { getPublicOriginFromAppRouterHeaders } from '@/lib/auth/public-app-url'
import { partnerSiteHref } from '@/lib/messaging/partner-custom-domain-site-path'
import { rewritePartnerCustomDomainOriginForSeo } from '@/lib/messaging/partner-custom-domain-hostname'
import { buildPartnerSiteProductKey } from '@/lib/partner-website/shop/partner-site-product-slug'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'

export const dynamic = 'force-dynamic'

/** Giới hạn an toàn 1 sitemap (chuẩn chung ~50k, giữ nhỏ hơn cho lần đầu — chưa cần chia nhiều file). */
const MAX_SITEMAP_PRODUCTS = 5000

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function urlEntry(loc: string, lastmod?: string): string {
  return `<url><loc>${xmlEscape(loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`
}

/**
 * S0.5/W4.13 — sitemap.xml riêng theo từng shop: trang chủ + danh mục (active + seo_index) + sản phẩm active.
 * Tương thích domain riêng (đăng ký `sitemap.xml` vào SHOP_PUBLIC_ROOT_SEGMENTS).
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) {
    return new NextResponse('Not found', { status: 404 })
  }
  const website = await fetchPartnerWebsiteByPartnerIdPg(shop.partnerId)
  if (!website?.isPublished) {
    return new NextResponse('Not found', { status: 404 })
  }

  const onCustomDomain = Boolean(readPartnerCustomDomainFromHeaders((name) => req.headers.get(name)))
  const rawOrigin = getPublicOriginFromAppRouterHeaders(req.headers)
  const origin = onCustomDomain ? rewritePartnerCustomDomainOriginForSeo(rawOrigin) : rawOrigin
  const abs = (subpath: string) => `${origin}${partnerSiteHref(shop.site.siteSlug, subpath, onCustomDomain)}`

  const [categories, products] = await Promise.all([
    fetchPartnerCategoriesFlatFromPg(shop.partnerId, { activeOnly: true }),
    fetchPartnerInventoryFullListOrderedCreatedFromPg(shop.partnerId),
  ])

  const entries: string[] = [urlEntry(abs('/'))]

  // W3.2 — trang phụ indexable (bỏ thank-you: noindex / sau checkout).
  for (const path of ['/about', '/contact', '/faq', '/shipping', '/returns', '/privacy', '/terms', '/payment', '/stores', '/lookbook', '/size-guide', '/blog', '/sale'] as const) {
    entries.push(urlEntry(abs(path)))
  }

  for (const cat of categories ?? []) {
    if (!cat.seoIndex) continue
    entries.push(urlEntry(abs(`/c/${cat.path}`), cat.updatedAt || undefined))
  }

  const activeProducts = (products ?? []).filter((p) => p.is_active !== false).slice(0, MAX_SITEMAP_PRODUCTS)
  for (const p of activeProducts) {
    const key = buildPartnerSiteProductKey(p.name, p.id)
    entries.push(urlEntry(abs(`/products/${key}`), p.updated_at || undefined))
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>`

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=1800, stale-while-revalidate=3600',
    },
  })
}
