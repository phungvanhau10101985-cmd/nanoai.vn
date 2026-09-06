import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerWebsitePageKey } from '@/lib/partner-website/partner-website-page-catalog'
import type { PartnerWebsiteProject } from '@/lib/partner-website/partner-website-types'
import type {
  PartnerWebsitePage,
  PartnerWebsiteTheme,
} from '@/lib/partner-website/template/partner-website-template-types'
import {
  BLANK_SHOP_VISUAL_PAGE_KEYS,
  seedBlankShopVisualWebsite,
} from '@/lib/partner-website/shop/build-blank-shop-visual-html'
import { buildShopTemplatePageVisualHtml } from '@/lib/partner-website/shop/build-shop-template-page-visual-html'
import { buildMarketplaceShopHomeHtml } from '@/lib/partner-website/shop/build-marketplace-shop-home-html'
import { buildDefaultDemoPdpShellHtml } from '@/lib/partner-website/shop/build-default-demo-pdp-shell-html'
import { ensureFullPartnerSiteFooterInHtml } from '@/lib/partner-website/shop/build-partner-site-footer-html'
import {
  isMarketplaceLook,
  isMarketplaceTemplateId,
  resolvePartnerWebsiteLook,
  stampPartnerWebsiteLookInHtml,
} from '@/lib/partner-website/shop/marketplace-shop-look-css'
import { ensurePartnerSiteChromeKitInHtml } from '@/lib/partner-website/shop/partner-site-chrome-kit'
import { stampPartnerShopEditorHooksInHtml } from '@/lib/partner-website/shop/inject-partner-shop-runtime-scripts'
import { applySharedChrome, extractSharedChrome } from '@/lib/partner-website/shop/sync-shared-chrome'
import { renderTemplateSiteToHtml } from '@/lib/partner-website/template/render-template-html'
import { visualHtmlLooksCompleteForEditor } from '@/lib/partner-website/visual-editor/visual-html-detect'
import { ensurePromoMarketingBannerInHtml } from '@/lib/partner-website/visual-editor/banner-widgets'
import {
  applyVisualEditThemeFlag,
  ensureVisualHtmlLiveReady,
  isolateVisualHtmlForDevice,
  mergeVisualPageHtmlIntoProject,
  visualEditorHtmlPath,
  VISUAL_DEVICE_VARIANTS,
  type VisualDeviceVariant,
} from '@/lib/partner-website/visual-editor/visual-editor-pages'

/** Every built-in route gets a canonical file on every device before the first edit. */
export const SHOP_TEMPLATE_VISUAL_PAGE_KEYS: PartnerWebsitePageKey[] = [
  ...BLANK_SHOP_VISUAL_PAGE_KEYS,
]

function stampHomePageAttr(html: string): string {
  if (/\bdata-pw-page=/.test(html)) {
    return html.replace(/\bdata-pw-page=(["'])[^"']*\1/i, 'data-pw-page="home"')
  }
  return html.replace(/<body\b([^>]*)>/i, '<body$1 data-pw-page="home">')
}

function finishVisualHtml(
  html: string,
  variant: VisualDeviceVariant,
  input: {
    locale: WebLocale
    siteSlug: string
    brand: string
    logoUrl?: string | null
    look?: PartnerWebsiteTheme['look']
  }
): string {
  const isolated = isolateVisualHtmlForDevice(html, variant)
  const withFooter = ensureFullPartnerSiteFooterInHtml(isolated, {
    locale: input.locale,
    siteSlug: input.siteSlug,
    brand: input.brand,
    logoUrl: input.logoUrl,
  })
  const withKit = ensurePartnerSiteChromeKitInHtml(withFooter, {
    locale: input.locale,
    siteSlug: input.siteSlug,
    device: variant,
    logoUrl: input.logoUrl,
  })
  const stamped = stampPartnerShopEditorHooksInHtml(withKit, { siteSlug: input.siteSlug })
  const withPromo = ensurePromoMarketingBannerInHtml(stamped, {
    siteSlug: input.siteSlug,
    locale: input.locale,
  })
  const ready = ensureVisualHtmlLiveReady(withPromo, variant)
  return stampPartnerWebsiteLookInHtml(ready, resolvePartnerWebsiteLook({ look: input.look }, ready))
}

export function buildShopTemplateHomeVisualHtml(input: {
  variant: VisualDeviceVariant
  locale: WebLocale
  siteSlug: string
  brand: string
  logoUrl?: string | null
  templateId: string
  theme: PartnerWebsiteTheme
  pages: PartnerWebsitePage[]
  chatPath?: string
  samplePreview?: boolean
}): string {
  const marketplace = isMarketplaceTemplateId(input.templateId) || isMarketplaceLook(input.theme)
  const raw = stampHomePageAttr(
    marketplace
      ? buildMarketplaceShopHomeHtml({
          variant: input.variant,
          locale: input.locale,
          siteSlug: input.siteSlug,
          brand: input.brand,
          logoUrl: input.logoUrl,
          theme: input.theme,
          chatPath: input.chatPath,
          samplePreview: input.samplePreview,
        })
      : renderTemplateSiteToHtml({
          locale: input.locale,
          title: input.brand,
          templateId: input.templateId,
          theme: input.theme,
          pages: input.pages,
          siteSlug: input.siteSlug,
          logoUrl: input.logoUrl,
          chatPath: input.chatPath,
          variant: input.variant,
        })
  )
  return finishVisualHtml(raw, input.variant, { ...input, look: input.theme.look })
}

function completeVisualHtml(html: string): string {
  const trimmed = html.trim()
  return trimmed.length >= 40 && visualHtmlLooksCompleteForEditor(trimmed) ? trimmed : ''
}

function readProjectVisualHtml(
  project: PartnerWebsiteProject,
  pageKey: PartnerWebsitePageKey,
  variant: VisualDeviceVariant
): string {
  const path = visualEditorHtmlPath(pageKey, variant)
  const file = project.files.find((item) => item.path === path && item.kind === 'html')
  return completeVisualHtml(file?.content || '')
}

function composedDeviceSlice(html: string, variant: VisualDeviceVariant): string {
  if (!html.trim() || !new RegExp(`data-pw-visual-device=["']${variant}["']`, 'i').test(html)) return ''
  return completeVisualHtml(isolateVisualHtmlForDevice(html, variant))
}

function visualDeviceFlagSnapshot(theme: PartnerWebsiteTheme): string {
  return [
    theme.useVisualHtml ? 'd' : '',
    theme.useVisualLaptopHtml ? 'l' : '',
    theme.useVisualTabletHtml ? 't' : '',
    theme.useVisualMobileHtml ? 'm' : '',
    (theme.visualPageKeys ?? []).join(','),
    (theme.visualLaptopPageKeys ?? []).join(','),
    (theme.visualTabletPageKeys ?? []).join(','),
    (theme.visualMobilePageKeys ?? []).join(','),
  ].join('|')
}

function buildShopTemplatePdpVisualHtml(input: {
  variant: VisualDeviceVariant
  locale: WebLocale
  siteSlug: string
  brand: string
  logoUrl?: string | null
  homeHtml: string
  look?: PartnerWebsiteTheme['look']
}): string {
  const shell = buildDefaultDemoPdpShellHtml({
    locale: input.locale,
    siteSlug: input.siteSlug,
    variant: input.variant,
    title: input.brand,
    logoUrl: input.logoUrl,
  })
  const chrome = extractSharedChrome(input.homeHtml)
  const withChrome = applySharedChrome(shell, chrome, { targetVariant: input.variant })
  return finishVisualHtml(withChrome, input.variant, input)
}

/**
 * After reset / apply a shop preset, write the same visual HTML Sửa nhanh and live read.
 * Do not leave live on React while Sửa nhanh freezes a different DOM.
 */
export function seedShopTemplateVisualWebsite(input: {
  project: PartnerWebsiteProject
  theme: PartnerWebsiteTheme
  pages: PartnerWebsitePage[]
  locale: WebLocale
  siteSlug: string
  brand: string
  logoUrl?: string | null
  templateId: string
  chatPath?: string
  htmlSource?: string | null
  /** Keep already-saved device files (Đăng web / live). Full seed overwrites. */
  onlyMissing?: boolean
  pageKeys?: PartnerWebsitePageKey[]
  /** Live: fill only the machine being viewed. Seed / reset still omit this (all 4). */
  devices?: VisualDeviceVariant[]
}): { project: PartnerWebsiteProject; theme: PartnerWebsiteTheme; htmlSource: string; changed: boolean } {
  const onlyMissing = input.onlyMissing === true
  const pageKeys = input.pageKeys?.length ? input.pageKeys : SHOP_TEMPLATE_VISUAL_PAGE_KEYS
  const filteredDevices = input.devices?.length
    ? VISUAL_DEVICE_VARIANTS.filter((device) => input.devices!.includes(device))
    : VISUAL_DEVICE_VARIANTS
  const devices = filteredDevices.length ? filteredDevices : VISUAL_DEVICE_VARIANTS
  let project = input.project
  let theme = { ...input.theme }
  const flagsBefore = visualDeviceFlagSnapshot(theme)
  let htmlSource = completeVisualHtml(input.htmlSource || '')
  let changed = false
  const homeByVariant = {} as Record<VisualDeviceVariant, string>
  const desktopHomeExisting =
    readProjectVisualHtml(project, 'home', 'desktop') || completeVisualHtml(input.htmlSource || '')

  for (const variant of devices) {
    const existing = readProjectVisualHtml(project, 'home', variant)
    const fromComposed =
      !existing && onlyMissing ? composedDeviceSlice(desktopHomeExisting, variant) : ''
    const kept = existing || fromComposed
    if (onlyMissing && kept) {
      homeByVariant[variant] = kept
      if (fromComposed) {
        project = mergeVisualPageHtmlIntoProject(project, fromComposed, visualEditorHtmlPath('home', variant))
        changed = true
      }
      theme = applyVisualEditThemeFlag(theme, { pageKey: 'home', variant })
      if (variant === 'desktop' && !htmlSource) htmlSource = kept
      continue
    }
    const home = buildShopTemplateHomeVisualHtml({
      variant,
      locale: input.locale,
      siteSlug: input.siteSlug,
      brand: input.brand,
      logoUrl: input.logoUrl,
      templateId: input.templateId,
      theme: input.theme,
      pages: input.pages,
      chatPath: input.chatPath,
    })
    homeByVariant[variant] = home
    project = mergeVisualPageHtmlIntoProject(project, home, visualEditorHtmlPath('home', variant))
    theme = applyVisualEditThemeFlag(theme, { pageKey: 'home', variant })
    changed = true
    if (variant === 'desktop') htmlSource = htmlSource || home
  }

  for (const pageKey of pageKeys) {
    if (pageKey === 'home') continue
    const desktopPageExisting = readProjectVisualHtml(project, pageKey, 'desktop')
    for (const variant of devices) {
      const existing = readProjectVisualHtml(project, pageKey, variant)
      const fromComposed =
        !existing && onlyMissing ? composedDeviceSlice(desktopPageExisting, variant) : ''
      const kept = existing || fromComposed
      if (onlyMissing && kept) {
        if (fromComposed) {
          project = mergeVisualPageHtmlIntoProject(project, fromComposed, visualEditorHtmlPath(pageKey, variant))
          changed = true
        }
        theme = applyVisualEditThemeFlag(theme, { pageKey, variant })
        continue
      }
      const homeHtml = homeByVariant[variant]
      const html =
        pageKey === 'product_detail'
          ? buildShopTemplatePdpVisualHtml({
              variant,
              locale: input.locale,
              siteSlug: input.siteSlug,
              brand: input.brand,
              logoUrl: input.logoUrl,
              homeHtml,
              look: input.theme.look,
            })
          : finishVisualHtml(
              (() => {
                const professional = buildShopTemplatePageVisualHtml({
                  pageKey,
                  variant,
                  locale: input.locale,
                  siteSlug: input.siteSlug,
                  brand: input.brand,
                })
                const chrome = extractSharedChrome(homeHtml)
                return applySharedChrome(professional, chrome, { targetVariant: variant })
              })(),
              variant,
              { ...input, look: input.theme.look }
            )
      project = mergeVisualPageHtmlIntoProject(project, html, visualEditorHtmlPath(pageKey, variant))
      theme = applyVisualEditThemeFlag(theme, { pageKey, variant })
      changed = true
    }
  }

  return {
    project,
    theme,
    htmlSource,
    changed: changed || visualDeviceFlagSnapshot(theme) !== flagsBefore,
  }
}

/**
 * Đăng web / live: create any missing device files from factory (or split a composed document).
 * Never overwrite a machine the merchant already saved.
 */
export function fillMissingShopVisualDeviceFiles(input: {
  project: PartnerWebsiteProject
  theme: PartnerWebsiteTheme
  pages?: PartnerWebsitePage[]
  locale: WebLocale
  siteSlug: string
  brand: string
  logoUrl?: string | null
  templateId?: string
  chatPath?: string
  htmlSource?: string | null
  pageKeys?: PartnerWebsitePageKey[]
  devices?: VisualDeviceVariant[]
}): { project: PartnerWebsiteProject; theme: PartnerWebsiteTheme; htmlSource: string; changed: boolean } {
  if (input.templateId === 'blank-white') {
    return seedBlankShopVisualWebsite({
      project: input.project,
      theme: input.theme,
      locale: input.locale,
      siteSlug: input.siteSlug,
      brand: input.brand,
      htmlSource: input.htmlSource,
      onlyMissing: true,
      pageKeys: input.pageKeys,
      devices: input.devices,
    })
  }
  return seedShopTemplateVisualWebsite({
    project: input.project,
    theme: input.theme,
    pages: input.pages ?? [],
    locale: input.locale,
    siteSlug: input.siteSlug,
    brand: input.brand,
    logoUrl: input.logoUrl,
    templateId: input.templateId || 'landing-v1',
    chatPath: input.chatPath,
    htmlSource: input.htmlSource,
    onlyMissing: true,
    pageKeys: input.pageKeys,
    devices: input.devices,
  })
}
