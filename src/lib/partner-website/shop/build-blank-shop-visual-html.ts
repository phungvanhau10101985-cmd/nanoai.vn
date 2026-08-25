import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerWebsitePageKey } from '@/lib/partner-website/partner-website-page-catalog'
import type { PartnerWebsiteProject } from '@/lib/partner-website/partner-website-types'
import type { PartnerWebsiteTheme } from '@/lib/partner-website/template/partner-website-template-types'
import { escapeAttr, escapeHtml } from '@/lib/packaging/mockup-share-html'
import { buildPartnerSiteFooterHtml } from '@/lib/partner-website/shop/build-partner-site-footer-html'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import {
  ensureAdsPlatformPolicyParagraphs,
  getPartnerSiteInfoPage,
  isPartnerSiteAdsPolicyPageKey,
  PARTNER_SITE_PLATFORM_INFO_KEYS,
  type PartnerSiteInfoPageKey,
} from '@/lib/partner-website/shop/partner-site-shop-info-pages'
import { partnerSiteHomePath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import {
  PW_EL,
  PW_PAGE,
  PW_PAGE_BY_CATALOG_KEY,
  PW_REGION,
  pwElAttr,
  pwPageAttr,
  pwRegionAttr,
} from '@/lib/partner-website/visual-editor/pw-ui-contract'
import {
  applyVisualEditThemeFlag,
  mergeVisualPageHtmlIntoProject,
  VISUAL_DEVICE_VARIANTS,
  visualEditorHtmlPath,
  type VisualDeviceVariant,
} from '@/lib/partner-website/visual-editor/visual-editor-pages'

const INFO_PAGES: PartnerWebsitePageKey[] = [
  'about',
  'contact',
  'faq',
  'lookbook',
  'blog',
  'stores',
  'size_guide',
  'shipping',
  'returns',
  'payment',
  'privacy',
  'terms',
  'thank_you',
]

const SHOP_ROUTE_PAGES: PartnerWebsitePageKey[] = ['products', 'cart', 'account']

export const BLANK_SHOP_VISUAL_PAGE_KEYS: PartnerWebsitePageKey[] = [
  'home',
  'product_detail',
  ...SHOP_ROUTE_PAGES,
  ...INFO_PAGES,
]

function infoKeyForPage(pageKey: PartnerWebsitePageKey): PartnerSiteInfoPageKey | null {
  const dashed = (
    pageKey === 'size_guide' ? 'size-guide' : pageKey === 'thank_you' ? 'thank-you' : pageKey.replace(/_/g, '-')
  ) as PartnerSiteInfoPageKey
  return PARTNER_SITE_PLATFORM_INFO_KEYS.includes(dashed) ? dashed : null
}

function homeHref(siteSlug: string): string {
  return siteSlug.trim() ? partnerSiteHomePath(siteSlug.trim()) : '/'
}

function buildBlankFooterHtml(input: { locale: WebLocale; brand: string; siteSlug: string }): string {
  return buildPartnerSiteFooterHtml({
    locale: input.locale,
    brand: input.brand,
    siteSlug: input.siteSlug,
  })
}

function buildBlankBottomNavHtml(input: { locale: WebLocale; siteSlug: string; pdp?: boolean }): string {
  const shop = getPartnerSiteShopCopy(input.locale)
  const pdpAttr = input.pdp ? ' data-pw-pdp-bottom="1"' : ''
  return `<nav class="pw-bottom-nav" ${pwRegionAttr(PW_REGION.nav)}${pdpAttr}>
  <a href="${escapeAttr(homeHref(input.siteSlug))}" ${pwElAttr(PW_EL.navLink)} data-pw-chrome-btn="home">
    <span class="pw-chrome-icon-wrap"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z"/></svg></span>
    <span class="pw-shop-icon-label">${escapeHtml(shop.navHome)}</span>
  </a>
</nav>`
}

function buildHomeMain(): string {
  return `<main class="pw-shop-main" ${pwRegionAttr(PW_REGION.content)} data-pw-bg-role="content" style="min-height:100vh;background:var(--pw-bg,#fff)"></main>`
}

function buildInfoMain(pageKey: PartnerWebsitePageKey, locale: WebLocale): string {
  const infoKey = infoKeyForPage(pageKey)
  const block = infoKey ? getPartnerSiteInfoPage(infoKey, locale) : { title: pageKey, paragraphs: [] as string[] }
  const paragraphs =
    infoKey && isPartnerSiteAdsPolicyPageKey(infoKey)
      ? ensureAdsPlatformPolicyParagraphs(block.paragraphs, locale)
      : block.paragraphs
  const paras = paragraphs.map((p) => `<p ${pwElAttr(PW_EL.body)}>${escapeHtml(p)}</p>`).join('')
  return `<main class="pw-shop-main" ${pwRegionAttr(PW_REGION.content)} data-pw-bg-role="content" style="min-height:70vh;background:var(--pw-bg,#fff);padding:48px 24px">
  <h1 ${pwElAttr(PW_EL.heading)}>${escapeHtml(block.title)}</h1>
  ${paras}
</main>`
}

function buildProductMain(): string {
  return `<main class="pw-shop-main" data-pw-bg-role="content" style="min-height:100vh;background:var(--pw-bg,#fff);padding:24px">
  <section ${pwRegionAttr(PW_REGION.gallery)} style="min-height:240px"></section>
  <section ${pwRegionAttr(PW_REGION.pdpInfo)}>
    <h1 ${pwElAttr(PW_EL.title)}></h1>
    <div ${pwElAttr(PW_EL.price)}></div>
    <div ${pwElAttr(PW_EL.desc)}></div>
  </section>
</main>`
}

function pwPageForKey(pageKey: PartnerWebsitePageKey) {
  return PW_PAGE_BY_CATALOG_KEY[pageKey] || PW_PAGE.info
}

export function buildBlankShopVisualHtml(input: {
  pageKey: PartnerWebsitePageKey
  variant: VisualDeviceVariant
  locale: WebLocale
  siteSlug: string
  brand: string
}): string {
  const chrome = {
    locale: input.locale,
    brand: input.brand,
    siteSlug: input.siteSlug,
  }
  const main =
    input.pageKey === 'home' || SHOP_ROUTE_PAGES.includes(input.pageKey)
      ? buildHomeMain()
      : input.pageKey === 'product_detail'
        ? buildProductMain()
        : buildInfoMain(input.pageKey, input.locale)
  return `<!DOCTYPE html>
<html lang="${escapeAttr(input.locale)}" data-pw-edit-device="${input.variant}" data-pw-scene-lock="${input.variant}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(input.brand)}</title>
</head>
<body ${pwPageAttr(pwPageForKey(input.pageKey))} data-pw-bg-role="canvas" style="margin:0;background:var(--pw-bg,#fff);color:var(--pw-text,#111);font-family:var(--pw-font,system-ui,sans-serif)">
${main}
${buildBlankFooterHtml(chrome)}
${buildBlankBottomNavHtml({ ...chrome, pdp: input.pageKey === 'product_detail' })}
</body>
</html>`
}

export function seedBlankShopVisualWebsite(input: {
  project: PartnerWebsiteProject
  theme: PartnerWebsiteTheme
  locale: WebLocale
  siteSlug: string
  brand: string
}): { project: PartnerWebsiteProject; theme: PartnerWebsiteTheme; htmlSource: string } {
  let project = input.project
  let theme = { ...input.theme }
  let htmlSource = ''
  for (const pageKey of BLANK_SHOP_VISUAL_PAGE_KEYS) {
    for (const variant of VISUAL_DEVICE_VARIANTS) {
      const html = buildBlankShopVisualHtml({
        pageKey,
        variant,
        locale: input.locale,
        siteSlug: input.siteSlug,
        brand: input.brand,
      })
      const path = visualEditorHtmlPath(pageKey, variant)
      project = mergeVisualPageHtmlIntoProject(project, html, path)
      theme = applyVisualEditThemeFlag(theme, { pageKey, variant })
      if (pageKey === 'home' && variant === 'desktop') htmlSource = html
    }
  }
  return { project, theme, htmlSource }
}
