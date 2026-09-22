import { cache } from 'react'
import { getEmailSessionUser } from '@/lib/auth/email-session-user'
import { FEATURED_CATEGORY_TILE_DEFAULT, getSiteFeaturedCategoryBlock } from '@/lib/partner-website/shop/featured-categories'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { peekSiteVisitorAccountKey } from '@/lib/partner-website/shop/partner-site-personalization'
import type { LiveCategoryBind } from '@/lib/partner-website/shop/bind-live-nav-pills'

async function loadSiteLiveCategoryBindUncached(
  siteSlug: string,
  navOnly = false
): Promise<LiveCategoryBind | null> {
  const slug = siteSlug.trim().toLowerCase()
  if (!slug) return null
  try {
    const shop = await loadPartnerSiteShopContext(slug)
    if (!shop) return null
    const [accountKeyRaw, user] = await Promise.all([
      peekSiteVisitorAccountKey(),
      getEmailSessionUser(),
    ])
    const accountKey = accountKeyRaw || 'anonymous'
    const block = await getSiteFeaturedCategoryBlock({
      partnerId: shop.partnerId,
      siteSlug: shop.site.siteSlug,
      accountKey,
      linkedUserId: user?.id,
      locale: shop.site.locale,
      limit: navOnly ? 1 : FEATURED_CATEGORY_TILE_DEFAULT,
      skipTileImages: navOnly,
    })
    return {
      siteSlug: shop.site.siteSlug,
      locale: shop.site.locale,
      navRow: block.nav_row,
      showNavAll: block.show_nav_all,
      tiles: block.tiles,
      hubHref: block.hub_href,
    }
  } catch {
    return null
  }
}

/** Một lần / request cho cùng slug + navOnly. Chrome header truyền navOnly. */
export const loadSiteLiveCategoryBind = cache(loadSiteLiveCategoryBindUncached)
