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
import {
  isolateVisualHtmlForDevice,
  resolveExactVisualPageHtml,
  type VisualDeviceVariant,
} from '@/lib/partner-website/visual-editor/visual-editor-pages'

export type VisualHomeChromeWebsite = {
  theme?: PartnerWebsiteTheme | null
  project?: PartnerWebsiteProject | null
  htmlSource?: string | null
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

/** Same breakpoints as composed visual HTML (`composeResponsiveVisualHtml`). */
export const VISUAL_HOME_CHROME_SPLIT_CSS = `.pw-visual-desktop,.pw-visual-laptop,.pw-visual-tablet,.pw-visual-mobile{display:none!important}
@media (max-width:767px){
.pw-visual-mobile{display:block!important}
html:not(:has(.pw-visual-mobile)) .pw-visual-tablet{display:block!important}
html:not(:has(.pw-visual-mobile)):not(:has(.pw-visual-tablet)) .pw-visual-laptop{display:block!important}
html:not(:has(.pw-visual-mobile)):not(:has(.pw-visual-tablet)):not(:has(.pw-visual-laptop)) .pw-visual-desktop{display:block!important}
}
@media (min-width:768px) and (max-width:1279px){
.pw-visual-tablet{display:block!important}
html:not(:has(.pw-visual-tablet)) .pw-visual-laptop{display:block!important}
html:not(:has(.pw-visual-tablet)):not(:has(.pw-visual-laptop)) .pw-visual-desktop{display:block!important}
}
@media (min-width:1280px) and (max-width:1439px){
.pw-visual-laptop{display:block!important}
html:not(:has(.pw-visual-laptop)) .pw-visual-desktop{display:block!important}
}
@media (min-width:1440px){
.pw-visual-desktop{display:block!important}
html:not(:has(.pw-visual-desktop)) .pw-visual-laptop{display:block!important}
}`

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

export function visualHomeChromeForDevice(
  website: VisualHomeChromeWebsite,
  variant: VisualDeviceVariant
): SharedChrome | null {
  const parts = homeHtmlParts(website, variant)
  if (!parts.isolated) return null
  const chrome = fillMissingSharedChromeFloats(extractSharedChrome(parts.isolated), parts.raw)
  return hasSharedChrome(chrome) ? chrome : null
}

export function visualHomeChromeByDevice(website: VisualHomeChromeWebsite): VisualHomeChromeByDevice {
  const desktop = homeHtmlParts(website, 'desktop')
  const laptop = homeHtmlParts(website, 'laptop')
  const tablet = homeHtmlParts(website, 'tablet')
  const mobile = homeHtmlParts(website, 'mobile')
  const desktopChrome = desktop.isolated
    ? fillMissingSharedChromeFloats(extractSharedChrome(desktop.isolated), desktop.raw)
    : null
  const laptopChrome = laptop.isolated
    ? fillMissingSharedChromeFloats(extractSharedChrome(laptop.isolated), laptop.raw)
    : null
  const tabletChrome = tablet.isolated
    ? fillMissingSharedChromeFloats(extractSharedChrome(tablet.isolated), tablet.raw)
    : null
  const mobileChrome = mobile.isolated
    ? fillMissingSharedChromeFloats(extractSharedChrome(mobile.isolated), mobile.raw)
    : null
  return {
    desktop: desktopChrome && hasSharedChrome(desktopChrome) ? desktopChrome : null,
    laptop: laptopChrome && hasSharedChrome(laptopChrome) ? laptopChrome : null,
    tablet: tabletChrome && hasSharedChrome(tabletChrome) ? tabletChrome : null,
    mobile: mobileChrome && hasSharedChrome(mobileChrome) ? mobileChrome : null,
    desktopStyles: extractVisualDocumentStyles(desktop.stylesFrom),
    laptopStyles: extractVisualDocumentStyles(laptop.stylesFrom),
    tabletStyles: extractVisualDocumentStyles(tablet.stylesFrom),
    mobileStyles: extractVisualDocumentStyles(mobile.stylesFrom),
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
  if (variant === 'tablet') {
    return byDevice.tablet || byDevice.laptop || byDevice.desktop || byDevice.mobile
  }
  if (variant === 'mobile') {
    return byDevice.mobile || byDevice.tablet || byDevice.laptop || byDevice.desktop
  }
  if (variant === 'laptop') {
    return byDevice.laptop || byDevice.desktop || byDevice.tablet || byDevice.mobile
  }
  return byDevice.desktop || byDevice.laptop || byDevice.tablet || byDevice.mobile
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
  if (variant === 'tablet') {
    return byDevice.tabletStyles || byDevice.laptopStyles || byDevice.desktopStyles || byDevice.mobileStyles
  }
  if (variant === 'mobile') {
    return byDevice.mobileStyles || byDevice.tabletStyles || byDevice.laptopStyles || byDevice.desktopStyles
  }
  if (variant === 'laptop') {
    return byDevice.laptopStyles || byDevice.desktopStyles || byDevice.tabletStyles || byDevice.mobileStyles
  }
  if (variant === 'desktop') {
    return byDevice.desktopStyles || byDevice.laptopStyles || byDevice.tabletStyles || byDevice.mobileStyles
  }
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
  const visualChromeByDevice = visualHomeChromeByDevice(website)
  return {
    visualChromeByDevice,
    visualChromeStyles: pickVisualHomeStyles(visualChromeByDevice, previewDevice ?? null),
    previewDevice: previewDevice ?? null,
  }
}
