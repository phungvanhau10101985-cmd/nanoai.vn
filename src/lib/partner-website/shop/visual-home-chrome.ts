import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerWebsiteProject } from '@/lib/partner-website/partner-website-types'
import type { PartnerWebsiteTheme } from '@/lib/partner-website/template/partner-website-template-types'
import {
  extractVisualDocumentStyles,
  preferredVisualHomeStyleSource,
} from '@/lib/partner-website/shop/merge-visual-home-styles'
import {
  extractSharedChrome,
  fillMissingSharedChromeFloats,
  hasSharedChrome,
  type SharedChrome,
} from '@/lib/partner-website/shop/sync-shared-chrome'
import { ensurePartnerSiteChromeKitInHtml } from '@/lib/partner-website/shop/partner-site-chrome-kit'
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

function homeHtmlParts(
  website: VisualHomeChromeWebsite,
  variant: VisualDeviceVariant
): { isolated: string; stylesFrom: string; raw: string } {
  const raw = resolveExactVisualPageHtml(website, 'home', variant).trim()
  if (raw.length < 40) return { isolated: '', stylesFrom: '', raw: '' }
  const isolated = isolateVisualHtmlForDevice(raw, variant)
  const chromeHtml = isolated.length >= 40 ? isolated : raw
  return {
    isolated: chromeHtml,
    stylesFrom: preferredVisualHomeStyleSource(chromeHtml, raw),
    raw,
  }
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

function chromeAndStylesFromParts(
  parts: { isolated: string; stylesFrom: string; raw: string },
  variant: VisualDeviceVariant
): {
  chrome: SharedChrome | null
  styles: string
} {
  const extracted = parts.isolated
    ? fillMissingSharedChromeFloats(extractSharedChrome(parts.isolated), parts.raw)
    : null
  if (!extracted || !hasSharedChrome(extracted)) {
    return { chrome: null, styles: extractVisualDocumentStyles(parts.stylesFrom) }
  }
  const slim = [extracted.topbar, extracted.header, extracted.footer, extracted.bottomNav, extracted.floats]
    .filter(Boolean)
    .join('\n')
  const ensured = slim
    ? fillMissingSharedChromeFloats(
        extractSharedChrome(ensurePartnerSiteChromeKitInHtml(slim, { device: variant })),
        slim
      )
    : extracted
  return {
    chrome: ensured && hasSharedChrome(ensured) ? ensured : extracted,
    styles: extractVisualDocumentStyles(parts.stylesFrom),
  }
}

export function visualHomeChromeForDevice(
  website: VisualHomeChromeWebsite,
  variant: VisualDeviceVariant
): SharedChrome | null {
  return chromeAndStylesFromParts(homeHtmlParts(website, variant), variant).chrome
}

/** Live React only needs the machine currently viewing — skip parsing the other three HTML files. */
export function visualHomeChromeByDeviceFor(
  website: VisualHomeChromeWebsite,
  variant: VisualDeviceVariant
): VisualHomeChromeByDevice {
  const { chrome, styles } = chromeAndStylesFromParts(homeHtmlParts(website, variant), variant)
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
} {
  const visualChromeByDevice = previewDevice
    ? visualHomeChromeByDeviceFor(website, previewDevice)
    : visualHomeChromeByDevice(website)
  return {
    visualChromeByDevice,
    visualChromeStyles: pickVisualHomeStyles(visualChromeByDevice, previewDevice ?? null),
    previewDevice: previewDevice ?? null,
  }
}
