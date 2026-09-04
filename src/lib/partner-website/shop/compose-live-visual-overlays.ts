import { bindLiveCategorySurfacesInHtml } from '@/lib/partner-website/shop/bind-live-nav-pills'
import type { LiveCategoryBind } from '@/lib/partner-website/shop/bind-live-nav-pills'
import {
  bindLiveProductToPdpHtml,
  type LivePdpBindProduct,
} from '@/lib/partner-website/shop/bind-live-product-to-pdp-html'
import type { WebLocale } from '@/lib/i18n/config'
import type { VisualDeviceVariant } from '@/lib/partner-website/visual-editor/visual-editor-pages'

/**
 * Overlays on a cached visual shell. Order is fixed:
 * product bind first, then visitor pills/tiles so header chrome is not leftover demo.
 */
export function applyLiveVisualOverlays(
  preparedShell: string,
  input: {
    liveProduct?: LivePdpBindProduct | null
    liveCategoryBind?: LiveCategoryBind | null
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
  return bindLiveCategorySurfacesInHtml(withProduct, input.liveCategoryBind ?? null)
}
