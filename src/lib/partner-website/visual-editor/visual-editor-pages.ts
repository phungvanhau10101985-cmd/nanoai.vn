import {
  getPartnerWebsitePageDef,
  normalizePartnerWebsitePageKey,
  PARTNER_WEBSITE_PAGE_CATALOG,
  type PartnerWebsitePageKey,
} from '@/lib/partner-website/partner-website-page-catalog'
import type { PartnerWebsiteProject } from '@/lib/partner-website/partner-website-types'
import type { PartnerWebsiteTheme } from '@/lib/partner-website/template/partner-website-template-types'
import { extractIndexHtml } from '@/lib/partner-website/partner-website-project'
import { rewriteThemeCssVarsInHtml } from '@/lib/partner-website/template/partner-website-theme-tokens'
import type { PartnerSiteInfoPageKey } from '@/lib/partner-website/shop/partner-site-shop-info-pages'
import { isValidCustomPageSlug } from '@/lib/partner-website/pages/partner-static-page-types'
import {
  isPartnerInventoryUuid,
  parsePartnerSiteProductKey,
  partnerInventoryIdSlugSuffix,
} from '@/lib/partner-website/shop/partner-site-product-slug'
import { injectPartnerShopChromeLayoutCss } from '@/lib/partner-website/shop/partner-shop-chrome-layout-css'
import {
  chromeCountBadgeKindFromHtmlSnippet,
  copyMissingChromeCountBadgeWidgets,
  restampChromeCountBadgeWidgets,
} from '@/lib/partner-website/shop/chrome-count-badges'
import { stripEmptyLogoPlaceholdersFromHtml } from '@/lib/partner-website/visual-editor/strip-empty-logo-placeholders'

/** Pages shown in the dashboard preview picker (real `/site/{slug}/…` routes). */
export const VISUAL_EDITOR_PAGE_KEYS: PartnerWebsitePageKey[] = [
  'home',
  'products',
  'collection',
  'sale',
  'wishlist',
  'recently_viewed',
  'cart',
  'account',
  'orders',
  'addresses',
  'product_detail',
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

const VISUAL_EDITOR_PAGE_KEY_SET = new Set<string>(VISUAL_EDITOR_PAGE_KEYS)

/** One frozen PDP must not replace every live product page. */
const VISUAL_HTML_SERVE_EXCLUDED = new Set<PartnerWebsitePageKey>(['product_detail'])

export function isVisualEditorPageKey(value: string | null | undefined): value is PartnerWebsitePageKey {
  return Boolean(value && VISUAL_EDITOR_PAGE_KEY_SET.has(value))
}

export type VisualDeviceVariant = 'desktop' | 'tablet' | 'mobile'

export const VISUAL_DEVICE_VARIANTS: VisualDeviceVariant[] = ['desktop', 'tablet', 'mobile']

/** Same width as Sửa nhanh Mobile iframe — public ?pw-device=mobile must match. */
export const VISUAL_MOBILE_PREVIEW_PX = 390
/** Same width as Sửa nhanh Tablet iframe — public ?pw-device=tablet must match. */
export const VISUAL_TABLET_PREVIEW_PX = 768
/** Laptop + Desktop share the computer layout. Public tablet band ends just below. */
export const VISUAL_DESKTOP_MIN_PX = 1280

export function parseVisualDeviceVariant(raw: unknown): VisualDeviceVariant {
  return raw === 'mobile' || raw === 'tablet' ? raw : 'desktop'
}

export function visualDeviceVariantFromHtmlPath(path: string): VisualDeviceVariant {
  if (/\.mobile\.html$/i.test(path)) return 'mobile'
  if (/\.tablet\.html$/i.test(path)) return 'tablet'
  return 'desktop'
}

function visualHtmlFileForBase(baseHtmlPath: string, variant: VisualDeviceVariant): string {
  const base = baseHtmlPath.replace(/\.mobile\.html$/i, '.html').replace(/\.tablet\.html$/i, '.html')
  if (variant === 'mobile') return base.replace(/\.html$/i, '.mobile.html')
  if (variant === 'tablet') return base.replace(/\.html$/i, '.tablet.html')
  return base
}

export function appendVisualDeviceQuery(href: string, variant: VisualDeviceVariant): string {
  const base = href.trim()
  if (!base) return base
  const join = base.includes('?') ? '&' : '?'
  return `${base}${join}pw-device=${variant}`
}

export function visualEditorDeviceVariant(
  device: 'mobile' | 'tablet' | 'laptop' | 'desktop'
): VisualDeviceVariant {
  if (device === 'mobile') return 'mobile'
  if (device === 'tablet') return 'tablet'
  return 'desktop'
}

export function visualEditorHtmlPath(
  pageKey: PartnerWebsitePageKey,
  variant: VisualDeviceVariant = 'desktop'
): string {
  const base = getPartnerWebsitePageDef(pageKey)?.htmlPath ?? 'index.html'
  return visualHtmlFileForBase(base, variant)
}

export function visualEditorRoutePath(pageKey: PartnerWebsitePageKey): string {
  const route = getPartnerWebsitePageDef(pageKey)?.routePath ?? '/'
  return route === '/' ? '' : route
}

export function visualEditorPreviewPath(
  siteSlug: string,
  pageKey: PartnerWebsitePageKey,
  categoryPath?: string | null,
  productKey?: string | null,
  cmsSlug?: string | null
): string {
  const slug = siteSlug.trim()
  const cms = cmsSlug ? normalizeVisualCmsSlug(cmsSlug) : ''
  if (cms) {
    return `/site/${encodeURIComponent(slug)}/pages/${encodeURIComponent(cms)}`
  }
  if (pageKey === 'product_detail') {
    const key = productKey?.trim()
    if (key) return `/site/${encodeURIComponent(slug)}/products/${encodeURIComponent(key)}`
    return `/site/${encodeURIComponent(slug)}/products`
  }
  if (pageKey === 'collection' && categoryPath?.trim()) {
    const segs = normalizeVisualCategoryPath(categoryPath)
      .split('/')
      .filter(Boolean)
      .map((s) => encodeURIComponent(s))
    return `/site/${encodeURIComponent(slug)}/c/${segs.join('/')}`
  }
  const route = visualEditorRoutePath(pageKey)
  return `/site/${encodeURIComponent(slug)}${route}`
}

export function normalizeVisualCategoryPath(raw: string): string {
  return raw
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase()
    .slice(0, 600)
}

export function categoryVisualHtmlPath(
  categoryPath: string,
  variant: VisualDeviceVariant = 'desktop'
): string {
  const p = normalizeVisualCategoryPath(categoryPath).replace(/\//g, '__')
  if (!p || p.includes('..')) return visualHtmlFileForBase('c/_none.html', variant)
  return visualHtmlFileForBase(`c/${p}.html`, variant)
}

export function normalizeVisualCategoryPaths(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const next: string[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const p = normalizeVisualCategoryPath(item)
    if (!p || seen.has(p) || p.includes('..')) continue
    seen.add(p)
    next.push(p)
  }
  return next.slice(0, 80)
}

export function addVisualCategoryPath(existing: string[] | undefined, categoryPath: string): string[] {
  const p = normalizeVisualCategoryPath(categoryPath)
  if (!p) return existing ?? []
  const cur = existing ?? []
  return cur.includes(p) ? cur : [...cur, p]
}

export function normalizeVisualProductId(raw: string): string {
  const id = raw.trim().toLowerCase()
  return isPartnerInventoryUuid(id) ? id : ''
}

export function productVisualHtmlPath(
  productId: string,
  variant: VisualDeviceVariant = 'desktop'
): string {
  const id = normalizeVisualProductId(productId)
  if (!id) return visualHtmlFileForBase('p/_none.html', variant)
  return visualHtmlFileForBase(`p/${id}.html`, variant)
}

export function normalizeVisualProductIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const next: string[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const id = normalizeVisualProductId(item)
    if (!id || seen.has(id)) continue
    seen.add(id)
    next.push(id)
  }
  return next.slice(0, 80)
}

export function addVisualProductId(existing: string[] | undefined, productId: string): string[] {
  const id = normalizeVisualProductId(productId)
  if (!id) return existing ?? []
  const cur = existing ?? []
  return cur.includes(id) ? cur : [...cur, id]
}

export function normalizeVisualCmsSlug(raw: string): string {
  const slug = raw.trim().toLowerCase().replace(/^\/+|\/+$/g, '').slice(0, 80)
  if (!slug || slug.includes('..') || !isValidCustomPageSlug(slug)) return ''
  return slug
}

export function cmsVisualHtmlPath(cmsSlug: string, variant: VisualDeviceVariant = 'desktop'): string {
  const slug = normalizeVisualCmsSlug(cmsSlug)
  if (!slug) return visualHtmlFileForBase('cms/_none.html', variant)
  return visualHtmlFileForBase(`cms/${slug}.html`, variant)
}

export function normalizeVisualCmsSlugs(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const next: string[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const slug = normalizeVisualCmsSlug(item)
    if (!slug || seen.has(slug)) continue
    seen.add(slug)
    next.push(slug)
  }
  return next.slice(0, 80)
}

export function addVisualCmsSlug(existing: string[] | undefined, cmsSlug: string): string[] {
  const slug = normalizeVisualCmsSlug(cmsSlug)
  if (!slug) return existing ?? []
  const cur = existing ?? []
  return cur.includes(slug) ? cur : [...cur, slug]
}

export function visualEditorTargetHtmlPath(input: {
  pageKey: PartnerWebsitePageKey
  variant: VisualDeviceVariant
  categoryPath?: string | null
  productId?: string | null
  cmsSlug?: string | null
}): string {
  if (input.cmsSlug) return cmsVisualHtmlPath(input.cmsSlug, input.variant)
  if (input.productId) return productVisualHtmlPath(input.productId, input.variant)
  if (input.categoryPath) return categoryVisualHtmlPath(input.categoryPath, input.variant)
  return visualEditorHtmlPath(input.pageKey, input.variant)
}

export function normalizeVisualPageKeys(raw: unknown): PartnerWebsitePageKey[] {
  if (!Array.isArray(raw)) return []
  const next: PartnerWebsitePageKey[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const key = normalizePartnerWebsitePageKey(item)
    if (key === 'home' || seen.has(key)) continue
    if (!getPartnerWebsitePageDef(key)) continue
    seen.add(key)
    next.push(key)
  }
  return next
}

export function addVisualPageKey(
  existing: PartnerWebsitePageKey[] | undefined,
  pageKey: PartnerWebsitePageKey
): PartnerWebsitePageKey[] {
  if (pageKey === 'home') return existing ?? []
  const cur = existing ?? []
  return cur.includes(pageKey) ? cur : [...cur, pageKey]
}

export function applyVisualEditThemeFlag(
  theme: PartnerWebsiteTheme,
  input: {
    pageKey: PartnerWebsitePageKey
    variant: VisualDeviceVariant
    categoryPath?: string
    productId?: string
    cmsSlug?: string
  }
): PartnerWebsiteTheme {
  const { pageKey, variant, categoryPath = '', productId = '', cmsSlug = '' } = input
  if (productId) {
    if (variant === 'mobile') {
      return {
        ...theme,
        visualMobileProductIds: addVisualProductId(normalizeVisualProductIds(theme.visualMobileProductIds), productId),
      }
    }
    if (variant === 'tablet') {
      return {
        ...theme,
        visualTabletProductIds: addVisualProductId(normalizeVisualProductIds(theme.visualTabletProductIds), productId),
      }
    }
    return {
      ...theme,
      visualProductIds: addVisualProductId(normalizeVisualProductIds(theme.visualProductIds), productId),
    }
  }
  if (cmsSlug) {
    if (variant === 'mobile') {
      return {
        ...theme,
        visualMobileCmsSlugs: addVisualCmsSlug(normalizeVisualCmsSlugs(theme.visualMobileCmsSlugs), cmsSlug),
      }
    }
    if (variant === 'tablet') {
      return {
        ...theme,
        visualTabletCmsSlugs: addVisualCmsSlug(normalizeVisualCmsSlugs(theme.visualTabletCmsSlugs), cmsSlug),
      }
    }
    return {
      ...theme,
      visualCmsSlugs: addVisualCmsSlug(normalizeVisualCmsSlugs(theme.visualCmsSlugs), cmsSlug),
    }
  }
  if (categoryPath) {
    if (variant === 'mobile') {
      return {
        ...theme,
        visualMobileCategoryPaths: addVisualCategoryPath(
          normalizeVisualCategoryPaths(theme.visualMobileCategoryPaths),
          categoryPath
        ),
      }
    }
    if (variant === 'tablet') {
      return {
        ...theme,
        visualTabletCategoryPaths: addVisualCategoryPath(
          normalizeVisualCategoryPaths(theme.visualTabletCategoryPaths),
          categoryPath
        ),
      }
    }
    return {
      ...theme,
      visualCategoryPaths: addVisualCategoryPath(normalizeVisualCategoryPaths(theme.visualCategoryPaths), categoryPath),
    }
  }
  if (pageKey === 'home') {
    if (variant === 'mobile') return { ...theme, useVisualMobileHtml: true }
    if (variant === 'tablet') return { ...theme, useVisualTabletHtml: true }
    return { ...theme, useVisualHtml: true }
  }
  if (variant === 'mobile') {
    return {
      ...theme,
      visualMobilePageKeys: addVisualPageKey(normalizeVisualPageKeys(theme.visualMobilePageKeys), pageKey),
    }
  }
  if (variant === 'tablet') {
    return {
      ...theme,
      visualTabletPageKeys: addVisualPageKey(normalizeVisualPageKeys(theme.visualTabletPageKeys), pageKey),
    }
  }
  return {
    ...theme,
    visualPageKeys: addVisualPageKey(normalizeVisualPageKeys(theme.visualPageKeys), pageKey),
  }
}

function visualPageKeysForVariant(
  theme: PartnerWebsiteTheme | null | undefined,
  variant: VisualDeviceVariant
): string[] {
  if (variant === 'mobile') return theme?.visualMobilePageKeys ?? []
  if (variant === 'tablet') return theme?.visualTabletPageKeys ?? []
  return theme?.visualPageKeys ?? []
}

function visualCategoryPathsForVariant(
  theme: PartnerWebsiteTheme | null | undefined,
  variant: VisualDeviceVariant
): string[] {
  if (variant === 'mobile') return theme?.visualMobileCategoryPaths ?? []
  if (variant === 'tablet') return theme?.visualTabletCategoryPaths ?? []
  return theme?.visualCategoryPaths ?? []
}

function visualProductIdsForVariant(
  theme: PartnerWebsiteTheme | null | undefined,
  variant: VisualDeviceVariant
): string[] {
  if (variant === 'mobile') return theme?.visualMobileProductIds ?? []
  if (variant === 'tablet') return theme?.visualTabletProductIds ?? []
  return theme?.visualProductIds ?? []
}

function visualCmsSlugsForVariant(
  theme: PartnerWebsiteTheme | null | undefined,
  variant: VisualDeviceVariant
): string[] {
  if (variant === 'mobile') return theme?.visualMobileCmsSlugs ?? []
  if (variant === 'tablet') return theme?.visualTabletCmsSlugs ?? []
  return theme?.visualCmsSlugs ?? []
}

function visualHomeFlagForVariant(
  theme: PartnerWebsiteTheme | null | undefined,
  variant: VisualDeviceVariant
): boolean {
  if (variant === 'mobile') return Boolean(theme?.useVisualMobileHtml)
  if (variant === 'tablet') return Boolean(theme?.useVisualTabletHtml)
  return Boolean(theme?.useVisualHtml)
}

export function shouldServeVisualPageHtml(pageKey: PartnerWebsitePageKey): boolean {
  return !VISUAL_HTML_SERVE_EXCLUDED.has(pageKey)
}

type VisualWebsitePick = {
  theme?: PartnerWebsiteTheme | null
  project?: PartnerWebsiteProject | null
  htmlSource?: string | null
}

export function resolveExactVisualPageHtml(
  website: VisualWebsitePick,
  pageKey: PartnerWebsitePageKey,
  variant: VisualDeviceVariant = 'desktop'
): string {
  if (pageKey === 'home' && variant === 'desktop') {
    if (!website.theme?.useVisualHtml) return ''
    const source = website.htmlSource?.trim() || ''
    if (source.length >= 40) return source
    return extractIndexHtml(website.project ?? { entryPath: 'index.html', files: [] })?.trim() || ''
  }
  if (pageKey === 'home' && variant !== 'desktop') {
    if (!visualHomeFlagForVariant(website.theme, variant)) return ''
    const htmlPath = visualEditorHtmlPath('home', variant)
    const file = website.project?.files.find((f) => f.path === htmlPath && f.kind === 'html')
    return file?.content?.trim() || ''
  }
  const keys = visualPageKeysForVariant(website.theme, variant)
  if (!keys.includes(pageKey)) return ''
  const htmlPath = visualEditorHtmlPath(pageKey, variant)
  const file = website.project?.files.find((f) => f.path === htmlPath && f.kind === 'html')
  return file?.content?.trim() || ''
}

export function resolveSavedVisualPageHtml(input: {
  pageKey: PartnerWebsitePageKey
  variant?: VisualDeviceVariant
  htmlSource?: string | null
  project?: PartnerWebsiteProject | null
  theme?: VisualWebsitePick['theme']
}): string {
  return resolveExactVisualPageHtml(input, input.pageKey, input.variant ?? 'desktop')
}

function extractDeviceWrapperBody(html: string, variant: VisualDeviceVariant): string {
  const re = new RegExp(
    `<div[^>]*data-pw-visual-device="${variant}"[^>]*>([\\s\\S]*?)</div>\\s*(?=<div[^>]*data-pw-visual-device=|</body>)`,
    'i'
  )
  return html.match(re)?.[1]?.trim() || ''
}

function rebuildStandaloneHtml(sourceHtml: string, body: string): string {
  const parts = extractHtmlParts(sourceHtml)
  const head = parts.head.replace(/<style id="pw-visual-device-split">[\s\S]*?<\/style>/gi, '')
  return `<!DOCTYPE html>\n<html${parts.htmlAttrs || ' lang="vi"'}>
<head>
${head}
</head>
<body>
${body}
</body>
</html>`
}

/** Widget thêm bằng Sửa nhanh — gỡ khỏi bản máy kia. Giữ nút đếm (giỏ / thông báo / đã xem). */
export function stripVisualAddedChrome(html: string, opts?: { keepCountBadges?: boolean }): string {
  return html.replace(/<(a|button)\b[^>]*data-pw-chrome-added="1"[^>]*>[\s\S]*?<\/\1>/gi, (full) => {
    if (opts?.keepCountBadges && chromeCountBadgeKindFromHtmlSnippet(full)) return full
    return ''
  })
}

function stampVisualAddedChrome(html: string, variant: VisualDeviceVariant): string {
  const others = VISUAL_DEVICE_VARIANTS.filter((v) => v !== variant)
  let next = html
  for (const opposite of others) {
    next = next.replace(
      new RegExp(
        `<(a|button)\\b[^>]*data-pw-chrome-added="1"[^>]*data-pw-device="${opposite}"[^>]*>[\\s\\S]*?<\\/\\1>`,
        'gi'
      ),
      (full) => (chromeCountBadgeKindFromHtmlSnippet(full) ? full : '')
    )
  }
  next = next.replace(
    /<(a|button)\b([^>]*data-pw-chrome-added="1"[^>]*)>/gi,
    (full, tag: string, attrs: string) => {
      if (/\bdata-pw-device=/.test(attrs)) return full
      return `<${tag}${attrs} data-pw-device="${variant}">`
    }
  )
  return restampChromeCountBadgeWidgets(next, variant)
}

/** Lấy đúng một bản Mobile, Tablet hoặc Desktop từ HTML (kể cả trang đã gộp). */
export function isolateVisualHtmlForDevice(
  html: string,
  variant: VisualDeviceVariant,
  opts?: { stripAddedChrome?: boolean }
): string {
  const trimmed = html.trim()
  if (!trimmed) return ''
  const sliced =
    extractDeviceWrapperBody(trimmed, variant) ||
    (variant !== 'desktop' ? extractDeviceWrapperBody(trimmed, 'desktop') : '')
  const source = sliced ? rebuildStandaloneHtml(trimmed, sliced) : trimmed
  const stripped = opts?.stripAddedChrome
    ? stripVisualAddedChrome(source, { keepCountBadges: true })
    : source
  return stampVisualAddedChrome(stripped, variant)
}

function extractHtmlParts(html: string): { head: string; body: string; htmlAttrs: string } {
  const head = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? ''
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html
  const htmlAttrs = html.match(/<html([^>]*)>/i)?.[1] ?? ' lang="vi"'
  return { head, body, htmlAttrs }
}

const VISUAL_TWO_DEVICE_SPLIT_CSS = `.pw-visual-desktop{display:block}
.pw-visual-mobile{display:none!important}
@media (max-width:767px){
.pw-visual-desktop{display:none!important}
.pw-visual-mobile{display:block!important}
}
@media (min-width:768px){
[data-pw-chrome-added][data-pw-device="mobile"]:not([data-pw-chrome-count]),
.pw-header-actions [data-pw-chrome-added]:not([data-pw-device="desktop"]):not([data-pw-chrome-count]),
.pw-shop-header-actions [data-pw-chrome-added]:not([data-pw-device="desktop"]):not([data-pw-chrome-count]),
.pw-topbar [data-pw-chrome-added]:not([data-pw-device="desktop"]):not([data-pw-chrome-count]),
.pw-bottom-nav [data-pw-chrome-added]:not([data-pw-device="desktop"]):not([data-pw-chrome-count]),
.pw-shop-bottom-nav [data-pw-chrome-added]:not([data-pw-device="desktop"]):not([data-pw-chrome-count]){display:none!important}
}
@media (max-width:767px){
[data-pw-chrome-added][data-pw-device="desktop"]:not([data-pw-chrome-count]),
[data-pw-chrome-added][data-pw-device="tablet"]:not([data-pw-chrome-count]){display:none!important}
}`

const VISUAL_THREE_DEVICE_SPLIT_CSS = `.pw-visual-desktop,.pw-visual-tablet,.pw-visual-mobile{display:none!important}
@media (max-width:767px){
.pw-visual-mobile{display:block!important}
}
@media (min-width:768px) and (max-width:1279px){
.pw-visual-tablet{display:block!important}
[data-pw-chrome-added][data-pw-device="mobile"]:not([data-pw-chrome-count]),
[data-pw-chrome-added][data-pw-device="desktop"]:not([data-pw-chrome-count]){display:none!important}
}
@media (min-width:1280px){
.pw-visual-desktop{display:block!important}
[data-pw-chrome-added][data-pw-device="mobile"]:not([data-pw-chrome-count]),
[data-pw-chrome-added][data-pw-device="tablet"]:not([data-pw-chrome-count]){display:none!important}
}
@media (max-width:767px){
[data-pw-chrome-added][data-pw-device="desktop"]:not([data-pw-chrome-count]),
[data-pw-chrome-added][data-pw-device="tablet"]:not([data-pw-chrome-count]){display:none!important}
}`

const VISUAL_TABLET_DESKTOP_SPLIT_CSS = `.pw-visual-desktop,.pw-visual-tablet{display:none!important}
@media (max-width:1279px){
.pw-visual-tablet{display:block!important}
}
@media (min-width:1280px){
.pw-visual-desktop{display:block!important}
[data-pw-chrome-added][data-pw-device="tablet"]:not([data-pw-chrome-count]){display:none!important}
}
@media (max-width:767px){
[data-pw-chrome-added][data-pw-device="desktop"]:not([data-pw-chrome-count]){display:none!important}
}`

/** One document: desktop + tablet + mobile bodies, shown via CSS breakpoint. */
export function composeResponsiveVisualHtml(
  desktopHtml: string,
  mobileHtml: string,
  tabletHtml = ''
): string {
  const desktopRaw = desktopHtml.trim()
  const mobileRaw = mobileHtml.trim()
  const tabletRaw = tabletHtml.trim()
  let desktop = isolateVisualHtmlForDevice(desktopRaw, 'desktop')
  const mobile = isolateVisualHtmlForDevice(mobileRaw, 'mobile')
  const tablet = isolateVisualHtmlForDevice(tabletRaw, 'tablet')
  if (desktop.length >= 40 && mobile.length < 40 && tablet.length < 40) return desktop
  if (desktop.length < 40 && tablet.length >= 40) {
    desktop = isolateVisualHtmlForDevice(stripVisualAddedChrome(tablet, { keepCountBadges: true }), 'desktop')
  }
  if (desktop.length < 40 && mobile.length >= 40) {
    desktop = isolateVisualHtmlForDevice(stripVisualAddedChrome(mobile, { keepCountBadges: true }), 'desktop')
  }
  if (desktop.length < 40 && mobile.length < 40 && tablet.length < 40) return ''
  const hasMobile = mobile.length >= 40
  const hasTablet = tablet.length >= 40
  const d = extractHtmlParts(desktop)
  const m = extractHtmlParts(hasMobile ? mobile : desktop)
  const t = hasTablet ? extractHtmlParts(tablet) : null
  const splitCss = hasTablet
    ? hasMobile
      ? VISUAL_THREE_DEVICE_SPLIT_CSS
      : VISUAL_TABLET_DESKTOP_SPLIT_CSS
    : VISUAL_TWO_DEVICE_SPLIT_CSS
  const extraHead = [hasTablet ? t?.head || '' : '', hasMobile ? m.head : ''].filter(Boolean).join('\n')
  const tabletBlock = hasTablet
    ? `<div class="pw-visual-tablet" data-pw-visual-device="tablet">${t?.body || ''}</div>`
    : ''
  const mobileBlock = hasMobile
    ? `<div class="pw-visual-mobile" data-pw-visual-device="mobile">${m.body}</div>`
    : ''
  return `<!DOCTYPE html>
<html${d.htmlAttrs || ' lang="vi"'}>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
${d.head}
${extraHead}
<style id="pw-visual-device-split">
${splitCss}
</style>
</head>
<body>
<div class="pw-visual-desktop" data-pw-visual-device="desktop">${d.body}</div>
${tabletBlock}
${mobileBlock}
</body>
</html>`
}

function servePublicVisualHtml(
  desktop: string,
  mobile: string,
  theme?: PartnerWebsiteTheme | null,
  tablet = ''
): string {
  const composed = injectPartnerShopChromeLayoutCss(
    composeResponsiveVisualHtml(
      stripEmptyLogoPlaceholdersFromHtml(desktop),
      stripEmptyLogoPlaceholdersFromHtml(mobile),
      stripEmptyLogoPlaceholdersFromHtml(tablet)
    )
  )
  return theme ? rewriteThemeCssVarsInHtml(composed, theme) : composed
}

export function resolvePublicVisualPageHtml(
  website: VisualWebsitePick,
  pageKey: PartnerWebsitePageKey
): string {
  const desktop = resolveExactVisualPageHtml(website, pageKey, 'desktop')
  const mobile = resolveExactVisualPageHtml(website, pageKey, 'mobile')
  const tablet = resolveExactVisualPageHtml(website, pageKey, 'tablet')
  return servePublicVisualHtml(desktop, mobile, website.theme, tablet)
}

export function resolveExactVisualCategoryHtml(
  website: VisualWebsitePick,
  categoryPath: string,
  variant: VisualDeviceVariant = 'desktop'
): string {
  const path = normalizeVisualCategoryPath(categoryPath)
  if (!path) return ''
  const keys = visualCategoryPathsForVariant(website.theme, variant)
  if (!keys.includes(path)) return ''
  const htmlPath = categoryVisualHtmlPath(path, variant)
  const file = website.project?.files.find((f) => f.path === htmlPath && f.kind === 'html')
  return file?.content?.trim() || ''
}

export function resolvePublicVisualCategoryHtml(website: VisualWebsitePick, categoryPath: string): string {
  const desktop = resolveExactVisualCategoryHtml(website, categoryPath, 'desktop')
  const mobile = resolveExactVisualCategoryHtml(website, categoryPath, 'mobile')
  const tablet = resolveExactVisualCategoryHtml(website, categoryPath, 'tablet')
  return servePublicVisualHtml(desktop, mobile, website.theme, tablet)
}

export function resolveExactVisualProductHtml(
  website: VisualWebsitePick,
  productId: string,
  variant: VisualDeviceVariant = 'desktop'
): string {
  const id = normalizeVisualProductId(productId)
  if (!id) return ''
  const keys = visualProductIdsForVariant(website.theme, variant)
  if (!keys.includes(id)) return ''
  const htmlPath = productVisualHtmlPath(id, variant)
  const file = website.project?.files.find((f) => f.path === htmlPath && f.kind === 'html')
  return file?.content?.trim() || ''
}

export function resolvePublicVisualProductHtml(website: VisualWebsitePick, productId: string): string {
  const desktop = resolveExactVisualProductHtml(website, productId, 'desktop')
  const mobile = resolveExactVisualProductHtml(website, productId, 'mobile')
  const tablet = resolveExactVisualProductHtml(website, productId, 'tablet')
  return servePublicVisualHtml(desktop, mobile, website.theme, tablet)
}

export function resolveExactVisualCmsHtml(
  website: VisualWebsitePick,
  cmsSlug: string,
  variant: VisualDeviceVariant = 'desktop'
): string {
  const slug = normalizeVisualCmsSlug(cmsSlug)
  if (!slug) return ''
  const keys = visualCmsSlugsForVariant(website.theme, variant)
  if (!keys.includes(slug)) return ''
  const htmlPath = cmsVisualHtmlPath(slug, variant)
  const file = website.project?.files.find((f) => f.path === htmlPath && f.kind === 'html')
  return file?.content?.trim() || ''
}

export function resolvePublicVisualCmsHtml(website: VisualWebsitePick, cmsSlug: string): string {
  const desktop = resolveExactVisualCmsHtml(website, cmsSlug, 'desktop')
  const mobile = resolveExactVisualCmsHtml(website, cmsSlug, 'mobile')
  const tablet = resolveExactVisualCmsHtml(website, cmsSlug, 'tablet')
  return servePublicVisualHtml(desktop, mobile, website.theme, tablet)
}

export function mergeVisualPageHtmlIntoProject(
  project: PartnerWebsiteProject,
  html: string,
  htmlPath: string
): PartnerWebsiteProject {
  const path = htmlPath.trim() || 'index.html'
  let found = false
  const files = project.files.map((f) => {
    if (f.path === path && f.kind === 'html') {
      found = true
      return { ...f, content: html }
    }
    return f
  })
  if (!found) {
    files.push({ path, kind: 'html', content: html })
  }
  return syncChromeCountBadgesAcrossProjectFiles({ ...project, files }, path, html)
}

export function syncChromeCountBadgesAcrossProjectFiles<
  T extends { files: Array<{ path: string; kind: string; content: string }> },
>(project: T, sourcePath: string, sourceHtml: string): T {
  const path = sourcePath.trim() || 'index.html'
  const files = project.files.map((file) => {
    if (file.path === path && file.kind === 'html') return { ...file, content: sourceHtml }
    return file
  })
  for (const variant of VISUAL_DEVICE_VARIANTS) {
    const siblingPath = visualHtmlFileForBase(path, variant)
    if (siblingPath === path) continue
    const index = files.findIndex((file) => file.path === siblingPath && file.kind === 'html')
    if (index < 0) continue
    const current = files[index]?.content || ''
    if (!current.trim()) continue
    const next = copyMissingChromeCountBadgeWidgets(sourceHtml, current, variant)
    if (next !== current) files[index] = { ...files[index], content: next }
  }
  return { ...project, files }
}

export function preserveAndRecolorVisualPageFiles(input: {
  previous: PartnerWebsiteProject
  next: PartnerWebsiteProject
  theme: PartnerWebsiteTheme
  previousTheme?: PartnerWebsiteTheme | null
  visualPageKeys?: PartnerWebsitePageKey[]
  visualMobilePageKeys?: PartnerWebsitePageKey[]
  visualTabletPageKeys?: PartnerWebsitePageKey[]
  visualCategoryPaths?: string[]
  visualMobileCategoryPaths?: string[]
  visualTabletCategoryPaths?: string[]
  visualProductIds?: string[]
  visualMobileProductIds?: string[]
  visualTabletProductIds?: string[]
  visualCmsSlugs?: string[]
  visualMobileCmsSlugs?: string[]
  visualTabletCmsSlugs?: string[]
}): PartnerWebsiteProject {
  const desktopKeys = input.visualPageKeys ?? []
  const mobileKeys = input.visualMobilePageKeys ?? []
  const tabletKeys = input.visualTabletPageKeys ?? normalizeVisualPageKeys(input.theme.visualTabletPageKeys)
  const categoryPaths = input.visualCategoryPaths ?? []
  const mobileCategoryPaths = input.visualMobileCategoryPaths ?? []
  const tabletCategoryPaths =
    input.visualTabletCategoryPaths ?? normalizeVisualCategoryPaths(input.theme.visualTabletCategoryPaths)
  const productIds = input.visualProductIds ?? []
  const mobileProductIds = input.visualMobileProductIds ?? []
  const tabletProductIds =
    input.visualTabletProductIds ?? normalizeVisualProductIds(input.theme.visualTabletProductIds)
  const cmsSlugs = input.visualCmsSlugs ?? []
  const mobileCmsSlugs = input.visualMobileCmsSlugs ?? []
  const tabletCmsSlugs = input.visualTabletCmsSlugs ?? normalizeVisualCmsSlugs(input.theme.visualTabletCmsSlugs)
  const keepPaths = new Set<string>([
    ...desktopKeys.map((key) => visualEditorHtmlPath(key, 'desktop')),
    ...mobileKeys.map((key) => visualEditorHtmlPath(key, 'mobile')),
    ...tabletKeys.map((key) => visualEditorHtmlPath(key, 'tablet')),
    ...categoryPaths.map((p) => categoryVisualHtmlPath(p, 'desktop')),
    ...mobileCategoryPaths.map((p) => categoryVisualHtmlPath(p, 'mobile')),
    ...tabletCategoryPaths.map((p) => categoryVisualHtmlPath(p, 'tablet')),
    ...productIds.map((id) => productVisualHtmlPath(id, 'desktop')),
    ...mobileProductIds.map((id) => productVisualHtmlPath(id, 'mobile')),
    ...tabletProductIds.map((id) => productVisualHtmlPath(id, 'tablet')),
    ...cmsSlugs.map((s) => cmsVisualHtmlPath(s, 'desktop')),
    ...mobileCmsSlugs.map((s) => cmsVisualHtmlPath(s, 'mobile')),
    ...tabletCmsSlugs.map((s) => cmsVisualHtmlPath(s, 'tablet')),
    ...(input.theme.useVisualHtml ? ['index.html'] : []),
    ...(input.theme.useVisualMobileHtml ? ['index.mobile.html'] : []),
    ...(input.theme.useVisualTabletHtml ? ['index.tablet.html'] : []),
  ])
  if (!keepPaths.size) return input.next
  const kept = input.previous.files.filter((f) => f.kind === 'html' && keepPaths.has(f.path))
  if (!kept.length) return input.next
  const nextPaths = new Set(input.next.files.map((f) => f.path))
  const merged = [
    ...input.next.files,
    ...kept.filter((f) => !nextPaths.has(f.path)),
  ]
  return {
    ...input.next,
    files: merged.map((f) => {
      if (f.kind !== 'html' || !keepPaths.has(f.path)) return f
      const prev = input.previous.files.find((p) => p.path === f.path && p.kind === 'html')
      const content = prev?.content || f.content
      return { ...f, content: rewriteThemeCssVarsInHtml(content, input.theme, input.previousTheme) }
    }),
  }
}

const INFO_PAGE_TO_VISUAL: Record<PartnerSiteInfoPageKey, PartnerWebsitePageKey> = {
  about: 'about',
  contact: 'contact',
  faq: 'faq',
  sale: 'sale',
  shipping: 'shipping',
  returns: 'returns',
  privacy: 'privacy',
  terms: 'terms',
  payment: 'payment',
  'thank-you': 'thank_you',
  stores: 'stores',
  lookbook: 'lookbook',
  'size-guide': 'size_guide',
  blog: 'blog',
}

export function infoPageKeyToVisualPageKey(pageKey: PartnerSiteInfoPageKey): PartnerWebsitePageKey {
  return INFO_PAGE_TO_VISUAL[pageKey]
}

export function pageKeyFromSitePath(pathname: string, siteSlug: string): PartnerWebsitePageKey | null {
  const slug = siteSlug.trim()
  const prefix = `/site/${slug}`
  let rest = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname
  rest = rest.replace(/\/+$/, '') || '/'
  if (rest.startsWith('/lp/')) return null
  if (rest.startsWith('/account')) return 'account'
  if (rest === '/orders') return 'orders'
  if (rest === '/addresses') return 'addresses'
  if (rest.startsWith('/products/') && rest !== '/products') return 'product_detail'
  if (rest.startsWith('/c/')) return 'collection'
  if (rest.startsWith('/pages/')) return null
  if (rest === '/' || rest === '') return 'home'
  const hit = PARTNER_WEBSITE_PAGE_CATALOG.find((def) => {
    const route = def.routePath.replace(/\/+$/, '') || '/'
    return route === rest
  })
  if (hit && (isVisualEditorPageKey(hit.key) || hit.key === 'product_detail')) return hit.key
  return null
}

export function categoryPathFromSitePath(pathname: string, siteSlug: string): string | null {
  const slug = siteSlug.trim()
  const prefix = `/site/${slug}`
  let rest = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname
  rest = rest.replace(/\/+$/, '') || '/'
  if (!rest.startsWith('/c/')) return null
  try {
    return normalizeVisualCategoryPath(decodeURIComponent(rest.slice(3)))
  } catch {
    return normalizeVisualCategoryPath(rest.slice(3))
  }
}

export function productKeyFromSitePath(pathname: string, siteSlug: string): string | null {
  const slug = siteSlug.trim()
  const prefix = `/site/${slug}`
  let rest = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname
  rest = rest.replace(/\/+$/, '') || '/'
  if (!rest.startsWith('/products/') || rest === '/products') return null
  try {
    return decodeURIComponent(rest.slice('/products/'.length)).trim() || null
  } catch {
    return rest.slice('/products/'.length).trim() || null
  }
}

export function resolveVisualProductIdFromKey(
  key: string,
  products: Array<{ id: string }>
): string | null {
  const parsed = parsePartnerSiteProductKey(key)
  if (!parsed) return null
  if (parsed.kind === 'uuid') return parsed.inventoryId
  const hit = products.find((p) => partnerInventoryIdSlugSuffix(p.id) === parsed.idPrefix)
  return hit?.id ?? null
}

export function cmsSlugFromSitePath(pathname: string, siteSlug: string): string | null {
  const slug = siteSlug.trim()
  const prefix = `/site/${slug}`
  let rest = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname
  rest = rest.replace(/\/+$/, '') || '/'
  if (!rest.startsWith('/pages/')) return null
  try {
    return normalizeVisualCmsSlug(decodeURIComponent(rest.slice('/pages/'.length))) || null
  } catch {
    return normalizeVisualCmsSlug(rest.slice('/pages/'.length)) || null
  }
}
