import { NextRequest } from 'next/server'
import { fetchPartnerCategoriesFlatFromPg } from '@/lib/db/messaging-partner-categories-pg'
import { fetchPublishedPartnerWebsiteBySlugPg } from '@/lib/db/messaging-partner-websites-pg'
import { readPartnerCustomDomainFromHeaders } from '@/lib/auth/app-request-headers'
import { getPublicOriginFromAppRouterHeaders } from '@/lib/auth/public-app-url'
import { partnerSiteHref } from '@/lib/messaging/partner-custom-domain-site-path'
import { rewritePartnerCustomDomainOriginForSeo } from '@/lib/messaging/partner-custom-domain-hostname'
import { prunePartnerCategoriesMissingAncestors } from '@/lib/partner-website/category/partner-category-types'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { isPartnerCategoryNavJunkNode } from '@/lib/partner-website/shop/partner-site-category-mega-menu'
import { PARTNER_SIZE_GUIDE_KINDS } from '@/lib/partner-website/shop/partner-site-size-guide'
import { sitemapUrlEntry } from '@/lib/partner-website/shop/partner-site-sitemap'

export async function loadPartnerShopSitemapAbs(
  req: NextRequest,
  slug: string
): Promise<{ partnerId: string; siteSlug: string; abs: (subpath: string) => string } | null> {
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return null
  const published = await fetchPublishedPartnerWebsiteBySlugPg(slug, { projectFiles: 'none' })
  if (!published) return null
  const onCustomDomain = Boolean(readPartnerCustomDomainFromHeaders((name) => req.headers.get(name)))
  const rawOrigin = getPublicOriginFromAppRouterHeaders(req.headers)
  const origin = onCustomDomain ? rewritePartnerCustomDomainOriginForSeo(rawOrigin) : rawOrigin
  const siteSlug = shop.site.siteSlug
  return {
    partnerId: shop.partnerId,
    siteSlug,
    abs: (subpath: string) => `${origin}${partnerSiteHref(siteSlug, subpath, onCustomDomain)}`,
  }
}

export function partnerShopSitemapInfoPaths(): string[] {
  return [
    '/about',
    '/contact',
    '/faq',
    '/shipping',
    '/returns',
    '/privacy',
    '/terms',
    '/payment',
    '/how-to-buy',
    '/brand-origin',
    '/reviews-policy',
    '/trust',
    '/company',
    '/stores',
    '/lookbook',
    '/size-guide',
    ...PARTNER_SIZE_GUIDE_KINDS.map((kind) => `/size-guide/${kind}`),
    '/blog',
    '/sale',
    '/kho-sale',
    '/goi-y-tuoi-gioi',
  ]
}

export async function partnerShopSitemapPageEntries(partnerId: string, abs: (p: string) => string): Promise<string[]> {
  const entries: string[] = [sitemapUrlEntry(abs('/')), sitemapUrlEntry(abs('/c'))]
  for (const path of partnerShopSitemapInfoPaths()) {
    entries.push(sitemapUrlEntry(abs(path)))
  }
  const categories = await fetchPartnerCategoriesFlatFromPg(partnerId, { activeOnly: true })
  for (const cat of prunePartnerCategoriesMissingAncestors(categories ?? [])) {
    if (!cat.seoIndex || isPartnerCategoryNavJunkNode(cat)) continue
    entries.push(sitemapUrlEntry(abs(`/c/${cat.path}`), cat.updatedAt || undefined))
  }
  return entries
}
