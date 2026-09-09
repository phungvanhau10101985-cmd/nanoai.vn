import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerWebsiteProject } from '@/lib/partner-website/partner-website-types'
import type { PartnerWebsiteTheme } from '@/lib/partner-website/template/partner-website-template-types'
import { injectPartnerShopThemeCss } from '@/lib/partner-website/shop/build-shop-theme-css'
import { ensureFullPartnerSiteFooterInHtml } from '@/lib/partner-website/shop/build-partner-site-footer-html'
import {
  extractVisualDocumentStyles,
  preferredVisualHomeStyleSource,
} from '@/lib/partner-website/shop/merge-visual-home-styles'
import {
  injectMarketplaceLookIntoHtml,
  resolvePartnerWebsiteLook,
  type PartnerWebsiteLook,
} from '@/lib/partner-website/shop/marketplace-shop-look-css'
import { injectPartnerShopChromeLayoutCss } from '@/lib/partner-website/shop/partner-shop-chrome-layout-css'
import { ensurePartnerSiteChromeKitInHtml } from '@/lib/partner-website/shop/partner-site-chrome-kit'
import {
  extractSharedChrome,
  fillMissingSharedChromeFloats,
  hasSharedChrome,
  type SharedChrome,
} from '@/lib/partner-website/shop/sync-shared-chrome'
import {
  isolateVisualHtmlForDevice,
  resolveExactVisualPageHtml,
  VISUAL_FOUR_DEVICE_SPLIT_CSS,
  type VisualDeviceVariant,
} from '@/lib/partner-website/visual-editor/visual-editor-pages'

export type VisualHomeChromeWebsite = {
  theme?: PartnerWebsiteTheme | null
  project?: PartnerWebsiteProject | null
  htmlSource?: string | null
  siteSlug?: string | null
  locale?: WebLocale | null
}

export type VisualHomeChromeByDevice = {
  desktop: SharedChrome | null
  laptop: SharedChrome | null
  tablet: SharedChrome | null
  mobile: SharedChrome | null
  desktopStyles: string
  laptopStyles: string
  tabletStyles: string
  mobileStyles: string
}

/** Same four-device split as composed visual HTML — visible wrappers are `display:contents`. */
export const VISUAL_HOME_CHROME_SPLIT_CSS = VISUAL_FOUR_DEVICE_SPLIT_CSS

/** Same look inject as Sửa nhanh / live home so React cart/wishlist chrome is not raw HTML. */
function prepareHomeChromeSourceHtml(
  html: string,
  website: VisualHomeChromeWebsite,
  variant: VisualDeviceVariant
): string {
  if (html.trim().length < 40) return html
  const withFooter = ensureFullPartnerSiteFooterInHtml(html, {
    locale: website.locale ?? 'vi',
    siteSlug: website.siteSlug,
    logoUrl: website.theme?.logoUrl,
  })
  const withKit = ensurePartnerSiteChromeKitInHtml(withFooter, {
    locale: website.locale ?? 'vi',
    siteSlug: website.siteSlug,
    device: variant,
    logoUrl: website.theme?.logoUrl,
    chatIconLogoUrl: website.theme?.chatIconLogoUrl,
  })
  const withTheme = injectPartnerShopThemeCss(withKit, website.theme)
  const withChrome = injectPartnerShopChromeLayoutCss(withTheme)
  return injectMarketplaceLookIntoHtml(withChrome, website.theme)
}

function homeHtmlParts(
  website: VisualHomeChromeWebsite,
  variant: VisualDeviceVariant
): { isolated: string; stylesFrom: string; raw: string } {
  const raw = resolveExactVisualPageHtml(website, 'home', variant).trim()
  if (raw.length < 40) return { isolated: '', stylesFrom: '', raw: '' }
  const isolated = isolateVisualHtmlForDevice(raw, variant)
  const chromeHtml = isolated.length >= 40 ? isolated : raw
  const prepared = prepareHomeChromeSourceHtml(chromeHtml, website, variant)
  return {
    isolated: prepared,
    stylesFrom: preferredVisualHomeStyleSource(prepared, raw),
    raw: prepared,
  }
}

export function visualHomeChromeLookFor(
  website: VisualHomeChromeWebsite,
  variant: VisualDeviceVariant
): PartnerWebsiteLook {
  return resolvePartnerWebsiteLook(website.theme, homeHtmlParts(website, variant).isolated)
}

export function emptyVisualHomeChromeByDevice(): VisualHomeChromeByDevice {
  return {
    desktop: null,
    laptop: null,
    tablet: null,
    mobile: null,
    desktopStyles: '',
    laptopStyles: '',
    tabletStyles: '',
    mobileStyles: '',
  }
}

const CHROME_PRODUCT_CDN_RE = /alicdn\.com|alicdn\.net|tbcdn\.cn|1688\.com|alibaba\.com/i
const CHROME_KEEP_LOGO_RE =
  /data-pw-logo-slot|pw-chrome-chat-logo|pw-shop-footer-logo|\bclass=["'][^"']*\bpw-logo\b/i

/** Header/footer on React pages must not load leftover catalog / AliCDN product photos. */
export function stripProductPhotosFromChromeHtml(html: string): string {
  if (!html || !/<img\b/i.test(html)) return html
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    const src = tag.match(/\bsrc=["']([^"']*)["']/i)?.[1] || ''
    if (!CHROME_PRODUCT_CDN_RE.test(src) && !CHROME_PRODUCT_CDN_RE.test(tag)) return tag
    if (CHROME_KEEP_LOGO_RE.test(tag)) return tag
    return ''
  })
}

function slimChromePhotos(chrome: SharedChrome): SharedChrome {
  return {
    topbar: stripProductPhotosFromChromeHtml(chrome.topbar),
    header: stripProductPhotosFromChromeHtml(chrome.header),
    footer: stripProductPhotosFromChromeHtml(chrome.footer),
    bottomNav: stripProductPhotosFromChromeHtml(chrome.bottomNav),
    floats: stripProductPhotosFromChromeHtml(chrome.floats),
  }
}

function chromeAndStylesFromParts(parts: {
  isolated: string
  stylesFrom: string
  raw: string
}): {
  chrome: SharedChrome | null
  styles: string
} {
  const extracted = parts.isolated
    ? fillMissingSharedChromeFloats(extractSharedChrome(parts.isolated), parts.raw)
    : null
  if (!extracted || !hasSharedChrome(extracted)) {
    return { chrome: null, styles: extractVisualDocumentStyles(parts.stylesFrom) }
  }
  return {
    chrome: slimChromePhotos(extracted),
    styles: extractVisualDocumentStyles(parts.stylesFrom),
  }
}

export function visualHomeChromeForDevice(
  website: VisualHomeChromeWebsite,
  variant: VisualDeviceVariant
): SharedChrome | null {
  return chromeAndStylesFromParts(homeHtmlParts(website, variant)).chrome
}

/** Live React only needs the machine currently viewing — skip parsing the other three HTML files. */
export function visualHomeChromeByDeviceFor(
  website: VisualHomeChromeWebsite,
  variant: VisualDeviceVariant
): VisualHomeChromeByDevice {
  const { chrome, styles } = chromeAndStylesFromParts(homeHtmlParts(website, variant))
  const out = emptyVisualHomeChromeByDevice()
  if (variant === 'laptop') return { ...out, laptop: chrome, laptopStyles: styles }
  if (variant === 'tablet') return { ...out, tablet: chrome, tabletStyles: styles }
  if (variant === 'mobile') return { ...out, mobile: chrome, mobileStyles: styles }
  return { ...out, desktop: chrome, desktopStyles: styles }
}

export function visualHomeChromeByDevice(website: VisualHomeChromeWebsite): VisualHomeChromeByDevice {
  const desktop = visualHomeChromeByDeviceFor(website, 'desktop')
  const laptop = visualHomeChromeByDeviceFor(website, 'laptop')
  const tablet = visualHomeChromeByDeviceFor(website, 'tablet')
  const mobile = visualHomeChromeByDeviceFor(website, 'mobile')
  return {
    desktop: desktop.desktop,
    laptop: laptop.laptop,
    tablet: tablet.tablet,
    mobile: mobile.mobile,
    desktopStyles: desktop.desktopStyles,
    laptopStyles: laptop.laptopStyles,
    tabletStyles: tablet.tabletStyles,
    mobileStyles: mobile.mobileStyles,
  }
}

export function hasVisualHomeChrome(byDevice: VisualHomeChromeByDevice | null | undefined): boolean {
  return Boolean(
    (byDevice?.desktop && hasSharedChrome(byDevice.desktop)) ||
      (byDevice?.laptop && hasSharedChrome(byDevice.laptop)) ||
      (byDevice?.tablet && hasSharedChrome(byDevice.tablet)) ||
      (byDevice?.mobile && hasSharedChrome(byDevice.mobile))
  )
}

export function pickVisualHomeChrome(
  byDevice: VisualHomeChromeByDevice,
  variant: VisualDeviceVariant
): SharedChrome | null {
  if (variant === 'tablet') return byDevice.tablet
  if (variant === 'mobile') return byDevice.mobile
  if (variant === 'laptop') return byDevice.laptop
  return byDevice.desktop
}

export function visualChromeBeforeMain(chrome: SharedChrome): string {
  return [chrome.topbar, chrome.header].filter(Boolean).join('\n')
}

export function visualChromeAfterMain(chrome: SharedChrome): string {
  return [chrome.footer, chrome.bottomNav, chrome.floats].filter(Boolean).join('\n')
}

export function pickVisualHomeStyles(
  byDevice: VisualHomeChromeByDevice,
  variant: VisualDeviceVariant | null
): string {
  if (variant === 'tablet') return byDevice.tabletStyles
  if (variant === 'mobile') return byDevice.mobileStyles
  if (variant === 'laptop') return byDevice.laptopStyles
  if (variant === 'desktop') return byDevice.desktopStyles
  const seen = new Set<string>()
  return [byDevice.desktopStyles, byDevice.laptopStyles, byDevice.tabletStyles, byDevice.mobileStyles]
    .filter((css) => {
      const key = css.trim()
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
    .join('\n')
}

export function visualHomeChromeShellProps(
  website: VisualHomeChromeWebsite,
  previewDevice?: VisualDeviceVariant | null
): {
  visualChromeByDevice: VisualHomeChromeByDevice
  visualChromeStyles: string
  previewDevice: VisualDeviceVariant | null
  chromeLook: PartnerWebsiteLook
} {
  const visualChromeByDevice = previewDevice
    ? visualHomeChromeByDeviceFor(website, previewDevice)
    : visualHomeChromeByDevice(website)
  const lookDevice = previewDevice || 'desktop'
  return {
    visualChromeByDevice,
    visualChromeStyles: pickVisualHomeStyles(visualChromeByDevice, previewDevice ?? null),
    previewDevice: previewDevice ?? null,
    chromeLook: visualHomeChromeLookFor(website, lookDevice),
  }
}
