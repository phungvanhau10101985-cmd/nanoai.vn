/** Pure URL builders — safe for client components (no server/DB imports). */

export function buildPartnerChatPublicUrl(origin: string, partnerSlug: string, embed = false): string {
  const base = origin.replace(/\/$/, '')
  const path = `/messaging/p/${encodeURIComponent(partnerSlug)}`
  return embed ? `${base}${path}?embed=1` : `${base}${path}`
}

export function buildPartnerSitePublicUrl(origin: string, siteSlug: string): string {
  const base = origin.replace(/\/$/, '')
  return `${base}/site/${encodeURIComponent(siteSlug)}`
}

export function buildPartnerSiteSitemapUrl(sitePublicUrl: string): string {
  const base = sitePublicUrl.trim().replace(/\/$/, '')
  return base ? `${base}/sitemap.xml` : ''
}

export function buildPartnerSiteSitemapPagesUrl(sitePublicUrl: string): string {
  const base = sitePublicUrl.trim().replace(/\/$/, '')
  return base ? `${base}/sitemap-pages.xml` : ''
}

export function buildPartnerSiteSitemapProductsUrl(sitePublicUrl: string, page = 1): string {
  const base = sitePublicUrl.trim().replace(/\/$/, '')
  return base ? `${base}/sitemap-products/${page}` : ''
}

/**
 * Builds the direct deep-link to Google Search Console Sitemaps management for a given site URL.
 * Note: Google Search Console uses resource_id with trailing slash (e.g. https://gudo.vn/ -> resource_id=https%3A%2F%2Fgudo.vn%2F).
 */
export function buildGoogleSearchConsoleSitemapsUrl(sitePublicUrl: string): string {
  const base = sitePublicUrl.trim().replace(/\/$/, '')
  if (!base) return 'https://search.google.com/search-console/sitemaps'
  const resourceId = `${base}/`
  return `https://search.google.com/search-console/sitemaps?resource_id=${encodeURIComponent(resourceId)}`
}

