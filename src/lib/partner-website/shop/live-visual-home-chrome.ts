import { bindLiveCategorySurfacesInHtml, type LiveCategoryBind } from '@/lib/partner-website/shop/bind-live-nav-pills'
import { loadSiteLiveCategoryBind } from '@/lib/partner-website/shop/load-site-live-category-bind'
import { ensureLiveHomeChromeWebsite } from '@/lib/partner-website/shop/load-live-visual-website'
import {
  visualHomeChromeShellProps,
  type VisualHomeChromeByDevice,
  type VisualHomeChromeWebsite,
} from '@/lib/partner-website/shop/visual-home-chrome'
import type { SharedChrome } from '@/lib/partner-website/shop/sync-shared-chrome'
import { inferLiveVisualRequestDevice } from '@/lib/partner-website/shop/infer-live-visual-request-device-server'
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
  const device = previewDevice || inferLiveVisualRequestDevice()
  const siteWithHome = website.siteSlug
    ? await ensureLiveHomeChromeWebsite(
        {
          siteSlug: website.siteSlug,
          project: website.project,
          htmlSource: website.htmlSource,
          theme: website.theme,
        },
        device
      )
    : website
  const props = visualHomeChromeShellProps(
    {
      ...website,
      project: siteWithHome.project ?? website.project,
      htmlSource: siteWithHome.htmlSource ?? website.htmlSource,
      theme: siteWithHome.theme ?? website.theme,
    },
    device
  )
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
