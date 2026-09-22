import {
  bindLiveCategorySurfacesInHtml,
  stripFeaturedCategoryHostsInHtml,
} from '@/lib/partner-website/shop/bind-live-nav-pills'
import type { LiveCategoryBind } from '@/lib/partner-website/shop/bind-live-nav-pills'
import { bindLiveMarketingBannersToHtml } from '@/lib/partner-website/shop/bind-live-marketing-banner'
import { bindLiveCatalogGridsToHtml, type LiveCatalogGridBind } from '@/lib/partner-website/shop/bind-live-catalog-grids-to-html'
import { injectPartnerShopLcpPreloadLinks } from '@/lib/partner-website/shop/preload-partner-shop-lcp'
import {
  bindLiveCategoryListingToHtml,
  type LiveCategoryListingBind,
} from '@/lib/partner-website/shop/bind-live-category-listing-to-html'
import {
  bindLiveProductToPdpHtml,
  type LivePdpBindProduct,
} from '@/lib/partner-website/shop/bind-live-product-to-pdp-html'
import type { PartnerMarketingBannerPublicItem } from '@/lib/partner-website/promotions/partner-marketing-banner'
import type { WebLocale } from '@/lib/i18n/config'
import type { VisualDeviceVariant } from '@/lib/partner-website/visual-editor/visual-editor-pages'

/**
 * Overlays on a cached visual shell. Order is fixed:
 * product / listing bind first, then visitor pills/tiles/banners so first paint is not leftover demo.
 */
export function applyLiveVisualOverlays(
  preparedShell: string,
  input: {
    liveProduct?: LivePdpBindProduct | null
    liveListing?: LiveCategoryListingBind | null
    liveCategoryBind?: LiveCategoryBind | null
    liveMarketingBanners?: PartnerMarketingBannerPublicItem[] | null
    liveCatalogGrids?: LiveCatalogGridBind | null
    locale: WebLocale
    siteSlug: string
    device?: VisualDeviceVariant | null
  }
): string {
  const withProduct = input.liveProduct
    ? bindLiveProductToPdpHtml(preparedShell, input.liveProduct, {
        locale: input.locale,
        siteSlug: input.siteSlug,
        device: input.device,
      })
    : preparedShell
  const withListing = input.liveListing
    ? bindLiveCategoryListingToHtml(withProduct, input.liveListing, {
        locale: input.locale,
        siteSlug: input.siteSlug,
      })
    : withProduct
  const withoutHub = input.liveListing ? stripFeaturedCategoryHostsInHtml(withListing) : withListing
  const withCategories = bindLiveCategorySurfacesInHtml(withoutHub, input.liveCategoryBind ?? null)
  const withBanners = bindLiveMarketingBannersToHtml(withCategories, input.liveMarketingBanners, input.locale)
  const withCatalog = bindLiveCatalogGridsToHtml(withBanners, input.liveCatalogGrids, {
    locale: input.locale,
    device: input.device,
  })
  return injectPartnerShopLcpPreloadLinks(withCatalog)
}
