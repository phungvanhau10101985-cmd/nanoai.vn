import type { PartnerWebsiteProject } from '@/lib/partner-website/partner-website-types'
import type { PartnerWebsiteTheme } from '@/lib/partner-website/template/partner-website-template-types'
import {
  extractVisualDocumentStyles,
  preferredVisualHomeStyleSource,
} from '@/lib/partner-website/shop/merge-visual-home-styles'
import {
  extractSharedChrome,
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
  tablet: SharedChrome | null
  mobile: SharedChrome | null
  desktopStyles: string
  tabletStyles: string
  mobileStyles: string
}

/** Same breakpoints as composed visual HTML (`composeResponsiveVisualHtml`). */
export const VISUAL_HOME_CHROME_SPLIT_CSS = `.pw-visual-desktop,.pw-visual-tablet,.pw-visual-mobile{display:none!important}
@media (max-width:767px){
.pw-visual-mobile{display:block!important}
}
@media (min-width:768px) and (max-width:1279px){
.pw-visual-tablet{display:block!important}
}
@media (min-width:1280px){
.pw-visual-desktop{display:block!important}
}`

function homeHtmlParts(
  website: VisualHomeChromeWebsite,
  variant: VisualDeviceVariant
): { isolated: string; stylesFrom: string } {
  const raw = resolveExactVisualPageHtml(website, 'home', variant).trim()
  if (raw.length < 40) return { isolated: '', stylesFrom: '' }
  const isolated = isolateVisualHtmlForDevice(raw, variant)
  const chromeHtml = isolated.length >= 40 ? isolated : raw
  return {
    isolated: chromeHtml,
    stylesFrom: preferredVisualHomeStyleSource(chromeHtml, raw),
  }
}

function isolatedHomeHtml(
  website: VisualHomeChromeWebsite,
  variant: VisualDeviceVariant
): string {
  return homeHtmlParts(website, variant).isolated
}

export function visualHomeChromeForDevice(
  website: VisualHomeChromeWebsite,
  variant: VisualDeviceVariant
): SharedChrome | null {
  const html = isolatedHomeHtml(website, variant)
  if (!html) return null
  const chrome = extractSharedChrome(html)
  return hasSharedChrome(chrome) ? chrome : null
}

export function visualHomeChromeByDevice(website: VisualHomeChromeWebsite): VisualHomeChromeByDevice {
  const desktop = homeHtmlParts(website, 'desktop')
  const tablet = homeHtmlParts(website, 'tablet')
  const mobile = homeHtmlParts(website, 'mobile')
  const desktopChrome = desktop.isolated ? extractSharedChrome(desktop.isolated) : null
  const tabletChrome = tablet.isolated ? extractSharedChrome(tablet.isolated) : null
  const mobileChrome = mobile.isolated ? extractSharedChrome(mobile.isolated) : null
  return {
    desktop: desktopChrome && hasSharedChrome(desktopChrome) ? desktopChrome : null,
    tablet: tabletChrome && hasSharedChrome(tabletChrome) ? tabletChrome : null,
    mobile: mobileChrome && hasSharedChrome(mobileChrome) ? mobileChrome : null,
    desktopStyles: extractVisualDocumentStyles(desktop.stylesFrom),
    tabletStyles: extractVisualDocumentStyles(tablet.stylesFrom),
    mobileStyles: extractVisualDocumentStyles(mobile.stylesFrom),
  }
}

export function hasVisualHomeChrome(byDevice: VisualHomeChromeByDevice | null | undefined): boolean {
  return Boolean(
    (byDevice?.desktop && hasSharedChrome(byDevice.desktop)) ||
      (byDevice?.tablet && hasSharedChrome(byDevice.tablet)) ||
      (byDevice?.mobile && hasSharedChrome(byDevice.mobile))
  )
}

export function pickVisualHomeChrome(
  byDevice: VisualHomeChromeByDevice,
  variant: VisualDeviceVariant
): SharedChrome | null {
  if (variant === 'tablet') {
    return byDevice.tablet || byDevice.desktop || byDevice.mobile
  }
  if (variant === 'mobile') {
    return byDevice.mobile || byDevice.tablet || byDevice.desktop
  }
  return byDevice.desktop || byDevice.tablet || byDevice.mobile
}

export function visualChromeBeforeMain(chrome: SharedChrome): string {
  return [chrome.topbar, chrome.header].filter(Boolean).join('\n')
}

export function visualChromeAfterMain(chrome: SharedChrome): string {
  return [chrome.footer, chrome.bottomNav].filter(Boolean).join('\n')
}

export function pickVisualHomeStyles(
  byDevice: VisualHomeChromeByDevice,
  variant: VisualDeviceVariant | null
): string {
  if (variant === 'tablet') {
    return byDevice.tabletStyles || byDevice.desktopStyles || byDevice.mobileStyles
  }
  if (variant === 'mobile') {
    return byDevice.mobileStyles || byDevice.tabletStyles || byDevice.desktopStyles
  }
  if (variant === 'desktop') {
    return byDevice.desktopStyles || byDevice.tabletStyles || byDevice.mobileStyles
  }
  const seen = new Set<string>()
  return [byDevice.desktopStyles, byDevice.tabletStyles, byDevice.mobileStyles]
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
