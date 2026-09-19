/**
 * Sitemap shop SaaS — index + pages tĩnh + sản phẩm phân trang 5k (giống 188).
 * Một engine mọi tenant. Không khóa slug.
 */

import {
  countPartnerProductSitemapPages,
  SITEMAP_PRODUCT_MAX_PAGES,
  SITEMAP_PRODUCT_PAGE_SIZE,
} from '@/lib/partner-website/shop/partner-catalog-scale'

export { countPartnerProductSitemapPages, SITEMAP_PRODUCT_MAX_PAGES, SITEMAP_PRODUCT_PAGE_SIZE }

export const SITEMAP_PAGES_PATH = '/sitemap-pages.xml'
export const SITEMAP_PRODUCT_PATH_PREFIX = '/sitemap-products'
export const SITEMAP_XML_HEADERS = {
  'Content-Type': 'application/xml; charset=utf-8',
  'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
} as const

export function xmlEscapeSitemap(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function sitemapUrlEntry(loc: string, lastmod?: string): string {
  return `<url><loc>${xmlEscapeSitemap(loc)}</loc>${lastmod ? `<lastmod>${xmlEscapeSitemap(lastmod)}</lastmod>` : ''}</url>`
}

export function buildPartnerShopSitemapIndexXml(input: {
  pagesLoc: string
  productPageLocs: string[]
}): string {
  const now = new Date().toISOString()
  const locs = [input.pagesLoc, ...input.productPageLocs]
  const entries = locs
    .map(
      (loc) =>
        `  <sitemap>\n    <loc>${xmlEscapeSitemap(loc)}</loc>\n    <lastmod>${now}</lastmod>\n  </sitemap>`
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</sitemapindex>
`
}

export function buildPartnerShopUrlsetXml(entries: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>
`
}

export function clampPartnerSitemapProductPage(page: number): number | null {
  const n = Math.floor(Number(page) || 0)
  if (n < 1 || n > SITEMAP_PRODUCT_MAX_PAGES) return null
  return n
}
