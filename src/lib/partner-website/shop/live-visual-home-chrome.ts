import { cache } from 'react'
import { withSiteChromeCache } from '@/lib/cache/partner-shop-cache'
import { bindLiveCategorySurfacesInHtml, type LiveCategoryBind } from '@/lib/partner-website/shop/bind-live-nav-pills'
import { loadSiteLiveCategoryBind } from '@/lib/partner-website/shop/load-site-live-category-bind'
import { ensureLiveHomeChromeWebsite } from '@/lib/partner-website/shop/load-live-visual-website'
import {
  pickVisualHomeStyles,
  visualHomeChromeByDeviceFor,
  type VisualHomeChromeByDevice,
  type VisualHomeChromeWebsite,
} from '@/lib/partner-website/shop/visual-home-chrome'
import type { SharedChrome } from '@/lib/partner-website/shop/sync-shared-chrome'
import { inferLiveVisualRequestDevice } from '@/lib/partner-website/shop/infer-live-visual-request-device-server'
import type { VisualDeviceVariant } from '@/lib/partner-website/visual-editor/visual-editor-pages'

export type LiveVisualHomeChromeShellProps = {
  visualChromeByDevice: VisualHomeChromeByDevice
  visualChromeStyles: string
  previewDevice: VisualDeviceVariant | null
  initialNavRow: LiveCategoryBind['navRow']
  initialShowNavAll: boolean
}

type CachedHomeChrome = {
  visualChromeByDevice: VisualHomeChromeByDevice
  visualChromeStyles: string
}

function bindSharedChromeNav(chrome: SharedChrome | null, bind: LiveCategoryBind | null): SharedChrome | null {
  if (!chrome || !bind) return chrome
  return {
    ...chrome,
    header: bindLiveCategorySurfacesInHtml(chrome.header, bind),
    topbar: bindLiveCategorySurfacesInHtml(chrome.topbar, bind),
  }
}

function isCachedHomeChrome(value: unknown): value is CachedHomeChrome {
  if (!value || typeof value !== 'object') return false
  const row = value as CachedHomeChrome
  return Boolean(row.visualChromeByDevice) && typeof row.visualChromeStyles === 'string'
}

async function extractHomeChromeForDevice(
  website: VisualHomeChromeWebsite,
  device: VisualDeviceVariant
): Promise<CachedHomeChrome> {
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
  const visualChromeByDevice = visualHomeChromeByDeviceFor(
    {
      ...website,
      project: siteWithHome.project ?? website.project,
      htmlSource: siteWithHome.htmlSource ?? website.htmlSource,
      theme: siteWithHome.theme ?? website.theme,
    },
    device
  )
  return {
    visualChromeByDevice,
    visualChromeStyles: pickVisualHomeStyles(visualChromeByDevice, device),
  }
}

async function liveVisualHomeChromeShellPropsUncached(
  website: VisualHomeChromeWebsite,
  previewDevice?: VisualDeviceVariant | null
): Promise<LiveVisualHomeChromeShellProps> {
  const device = previewDevice || inferLiveVisualRequestDevice()
  const extracted = website.siteSlug
    ? await withSiteChromeCache({
        slug: website.siteSlug,
        device,
        load: () => extractHomeChromeForDevice(website, device),
      }).then((hit) => (isCachedHomeChrome(hit) ? hit : extractHomeChromeForDevice(website, device)))
    : await extractHomeChromeForDevice(website, device)

  const bind = website.siteSlug ? await loadSiteLiveCategoryBind(website.siteSlug) : null
  if (!bind) {
    return { ...extracted, previewDevice: device, initialNavRow: [], initialShowNavAll: false }
  }
  const byDevice = extracted.visualChromeByDevice
  return {
    ...extracted,
    previewDevice: device,
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

/** Live: bind pill API vào chrome trang chủ trước khi copy sang mọi trang React. Một lần / request. */
export const liveVisualHomeChromeShellProps = cache(liveVisualHomeChromeShellPropsUncached)
