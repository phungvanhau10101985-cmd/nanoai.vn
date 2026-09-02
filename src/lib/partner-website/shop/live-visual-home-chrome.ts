import { bindLiveCategorySurfacesInHtml, type LiveCategoryBind } from '@/lib/partner-website/shop/bind-live-nav-pills'
import { loadSiteLiveCategoryBind } from '@/lib/partner-website/shop/load-site-live-category-bind'
import {
  visualHomeChromeShellProps,
  type VisualHomeChromeByDevice,
  type VisualHomeChromeWebsite,
} from '@/lib/partner-website/shop/visual-home-chrome'
import type { SharedChrome } from '@/lib/partner-website/shop/sync-shared-chrome'
import type { VisualDeviceVariant } from '@/lib/partner-website/visual-editor/visual-editor-pages'

function bindSharedChromeNav(chrome: SharedChrome | null, bind: LiveCategoryBind | null): SharedChrome | null {
  if (!chrome || !bind) return chrome
  return {
    ...chrome,
    header: bindLiveCategorySurfacesInHtml(chrome.header, bind),
    topbar: bindLiveCategorySurfacesInHtml(chrome.topbar, bind),
  }
}

/** Live: bind pill API vào chrome trang chủ trước khi copy sang mọi trang React. */
export async function liveVisualHomeChromeShellProps(
  website: VisualHomeChromeWebsite,
  previewDevice?: VisualDeviceVariant | null
): Promise<{
  visualChromeByDevice: VisualHomeChromeByDevice
  visualChromeStyles: string
  previewDevice: VisualDeviceVariant | null
  initialNavRow: LiveCategoryBind['navRow']
  initialShowNavAll: boolean
}> {
  const props = visualHomeChromeShellProps(website, previewDevice)
  const bind = website.siteSlug ? await loadSiteLiveCategoryBind(website.siteSlug) : null
  if (!bind) {
    return { ...props, initialNavRow: [], initialShowNavAll: false }
  }
  const byDevice = props.visualChromeByDevice
  return {
    ...props,
    visualChromeByDevice: {
      ...byDevice,
      desktop: bindSharedChromeNav(byDevice.desktop, bind),
      laptop: bindSharedChromeNav(byDevice.laptop, bind),
      tablet: bindSharedChromeNav(byDevice.tablet, bind),
      mobile: bindSharedChromeNav(byDevice.mobile, bind),
    },
    initialNavRow: bind.navRow,
    initialShowNavAll: bind.showNavAll,
  }
}
