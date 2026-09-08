import { bindLiveCategorySurfacesInHtml } from '@/lib/partner-website/shop/bind-live-nav-pills'
import type { LiveCategoryBind } from '@/lib/partner-website/shop/bind-live-nav-pills'
import { bindLiveMarketingBannersToHtml } from '@/lib/partner-website/shop/bind-live-marketing-banner'
import {
  bindLiveProductToPdpHtml,
  type LivePdpBindProduct,
} from '@/lib/partner-website/shop/bind-live-product-to-pdp-html'
import type { PartnerMarketingBannerPublicItem } from '@/lib/partner-website/promotions/partner-marketing-banner'
import type { WebLocale } from '@/lib/i18n/config'
import type { VisualDeviceVariant } from '@/lib/partner-website/visual-editor/visual-editor-pages'

/**
 * Overlays on a cached visual shell. Order is fixed:
 * product bind first, then visitor pills/tiles/banners so first paint is not leftover demo.
 */
export function applyLiveVisualOverlays(
  preparedShell: string,
  input: {
    liveProduct?: LivePdpBindProduct | null
    liveCategoryBind?: LiveCategoryBind | null
    liveMarketingBanners?: PartnerMarketingBannerPublicItem[] | null
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
  const withCategories = bindLiveCategorySurfacesInHtml(withProduct, input.liveCategoryBind ?? null)
  return bindLiveMarketingBannersToHtml(withCategories, input.liveMarketingBanners, input.locale)
}
