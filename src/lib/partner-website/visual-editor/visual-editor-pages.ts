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
import {
  mergeVisualHomeStylesIntoHtml,
  preferredVisualHomeStyleSource,
} from '@/lib/partner-website/shop/merge-visual-home-styles'
import { injectPartnerShopChromeLayoutCss } from '@/lib/partner-website/shop/partner-shop-chrome-layout-css'
import {
  chromeCountBadgeKindFromHtmlSnippet,
  copyMissingChromeCountBadgeWidgets,
  restampChromeCountBadgeWidgets,
} from '@/lib/partner-website/shop/chrome-count-badges'
import { stripEmptyLogoPlaceholdersFromHtml } from '@/lib/partner-website/visual-editor/strip-empty-logo-placeholders'
import {
  applySharedChrome,
  dedupeSharedShopHeaders,
  extractSharedChrome,
  fillMissingSharedChromeFloats,
  hasSharedChrome,
  hoistBodyLevelChromeFloats,
  hoistBodyLevelSharedChrome,
  hoistBodyLevelSceneOverlays,
  unwrapPersistedLiveChromeHtml,
} from '@/lib/partner-website/shop/sync-shared-chrome'
import {
  PW_SCENE_WIDTH,
  pwScaledFhdDesktopMediaQuery,
  pwSceneWidth,
} from '@/lib/partner-website/visual-editor/pw-coordinate-space'
import { normalizeWebLocale, type WebLocale } from '@/lib/i18n/config'
import { buildDefaultDemoPdpShellHtml } from '@/lib/partner-website/shop/build-default-demo-pdp-shell-html'
import {
  htmlHasPartnerVisualChrome,
  looksLikeVisualHomeHtml,
} from '@/lib/partner-website/visual-editor/visual-html-detect'

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

/** Generic `/products` listing must not use the PDP shell. Product pages hydrate live inventory onto that shell. */
const VISUAL_HTML_SERVE_EXCLUDED = new Set<PartnerWebsitePageKey>(['product_detail'])

export function isVisualEditorPageKey(value: string | null | undefined): value is PartnerWebsitePageKey {
  return Boolean(value && VISUAL_EDITOR_PAGE_KEY_SET.has(value))
}

export type VisualDeviceVariant = 'desktop' | 'laptop' | 'tablet' | 'mobile'

export const VISUAL_DEVICE_VARIANTS: VisualDeviceVariant[] = ['desktop', 'laptop', 'tablet', 'mobile']

/** Same width as Sửa nhanh Mobile iframe — public ?pw-device=mobile must match. */
export const VISUAL_MOBILE_PREVIEW_PX = PW_SCENE_WIDTH.mobile
/** Same width as Sửa nhanh Tablet iframe — public ?pw-device=tablet must match. */
export const VISUAL_TABLET_PREVIEW_PX = PW_SCENE_WIDTH.tablet
/** Same width as Sửa nhanh Laptop iframe — public ?pw-device=laptop must match. */
export const VISUAL_LAPTOP_PREVIEW_PX = PW_SCENE_WIDTH.laptop
/** Public tablet band ends just below. Wide desktop starts here when a laptop HTML exists. */
export const VISUAL_DESKTOP_MIN_PX = PW_SCENE_WIDTH.laptop
/** Wide desktop canvas (Sửa nhanh Desktop / composed split when laptop HTML exists). */
export const VISUAL_WIDE_DESKTOP_MIN_PX = PW_SCENE_WIDTH.desktop

/**
 * Iframe viewport for `?pw-device=` / Sửa nhanh canvas.
 * Docked DevTools shrinks the browser chrome — keep this width so desktop CSS does not collapse.
 */
/** Canvas width for Sửa nhanh / `?pw-device=` — centered on the screen midpoint. */
export function visualDeviceCanvasWidth(device: VisualDeviceVariant): number {
  return pwSceneWidth(device)
}

export function visualDevicePreviewFrameStyle(
  device: VisualDeviceVariant | null
): { width?: number; minWidth?: number } {
  if (!device) return {}
  const width = visualDeviceCanvasWidth(device)
  return { width, minWidth: width }
}

/**
 * Docked DevTools shrinks `innerWidth` (CSS viewport) but not `outerWidth` (browser window).
 * Use this so F12 does not switch the composed shop from desktop to tablet.
 * Phones/tablets keep outerWidth below 1280 — do not lock them to desktop.
 */
export function isDesktopBrowserWindow(win?: { outerWidth?: number } | null): boolean {
  const outer =
    win?.outerWidth ?? (typeof window !== 'undefined' ? window.outerWidth : 0)
  return (outer || 0) >= VISUAL_DESKTOP_MIN_PX
}

export function parseVisualDeviceVariant(raw: unknown): VisualDeviceVariant {
  return raw === 'mobile' || raw === 'tablet' || raw === 'laptop' ? raw : 'desktop'
}

/** Query `?pw-device=` from Sửa nhanh → Xem. Null = responsive composed page. */
export function parseVisualDeviceQuery(raw: unknown): VisualDeviceVariant | null {
  const v = Array.isArray(raw) ? raw[0] : raw
  return v === 'mobile' || v === 'tablet' || v === 'laptop' || v === 'desktop' ? v : null
}

export function visualDeviceVariantFromHtmlPath(path: string): VisualDeviceVariant {
  if (/\.mobile\.html$/i.test(path)) return 'mobile'
  if (/\.tablet\.html$/i.test(path)) return 'tablet'
  if (/\.laptop\.html$/i.test(path)) return 'laptop'
  return 'desktop'
}

function visualHtmlFileForBase(baseHtmlPath: string, variant: VisualDeviceVariant): string {
  const base = baseHtmlPath
    .replace(/\.mobile\.html$/i, '.html')
    .replace(/\.tablet\.html$/i, '.html')
    .replace(/\.laptop\.html$/i, '.html')
  if (variant === 'mobile') return base.replace(/\.html$/i, '.mobile.html')
  if (variant === 'tablet') return base.replace(/\.html$/i, '.tablet.html')
  if (variant === 'laptop') return base.replace(/\.html$/i, '.laptop.html')
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
  if (device === 'laptop') return 'laptop'
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

/** Shared PDP layout shell for every product on this device. */
export function productVisualShellHtmlPath(variant: VisualDeviceVariant = 'desktop'): string {
  return visualEditorHtmlPath('product_detail', variant)
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
    const withProductId =
      variant === 'mobile'
        ? {
            ...theme,
            visualMobileProductIds: addVisualProductId(
              normalizeVisualProductIds(theme.visualMobileProductIds),
              productId
            ),
          }
        : variant === 'tablet'
          ? {
              ...theme,
              visualTabletProductIds: addVisualProductId(
                normalizeVisualProductIds(theme.visualTabletProductIds),
                productId
              ),
            }
          : variant === 'laptop'
            ? {
                ...theme,
                visualLaptopProductIds: addVisualProductId(
                  normalizeVisualProductIds(theme.visualLaptopProductIds),
                  productId
                ),
              }
            : {
                ...theme,
                visualProductIds: addVisualProductId(normalizeVisualProductIds(theme.visualProductIds), productId),
              }
    return applyVisualEditThemeFlag(withProductId, { pageKey: 'product_detail', variant })
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
    if (variant === 'laptop') {
      return {
        ...theme,
        visualLaptopCmsSlugs: addVisualCmsSlug(normalizeVisualCmsSlugs(theme.visualLaptopCmsSlugs), cmsSlug),
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
    if (variant === 'laptop') {
      return {
        ...theme,
        visualLaptopCategoryPaths: addVisualCategoryPath(
          normalizeVisualCategoryPaths(theme.visualLaptopCategoryPaths),
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
    if (variant === 'laptop') return { ...theme, useVisualLaptopHtml: true }
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
  if (variant === 'laptop') {
    return {
      ...theme,
      visualLaptopPageKeys: addVisualPageKey(normalizeVisualPageKeys(theme.visualLaptopPageKeys), pageKey),
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
  if (variant === 'laptop') return theme?.visualLaptopPageKeys ?? []
  return theme?.visualPageKeys ?? []
}

function visualCategoryPathsForVariant(
  theme: PartnerWebsiteTheme | null | undefined,
  variant: VisualDeviceVariant
): string[] {
  if (variant === 'mobile') return theme?.visualMobileCategoryPaths ?? []
  if (variant === 'tablet') return theme?.visualTabletCategoryPaths ?? []
  if (variant === 'laptop') return theme?.visualLaptopCategoryPaths ?? []
  return theme?.visualCategoryPaths ?? []
}

function visualProductIdsForVariant(
  theme: PartnerWebsiteTheme | null | undefined,
  variant: VisualDeviceVariant
): string[] {
  if (variant === 'mobile') return theme?.visualMobileProductIds ?? []
  if (variant === 'tablet') return theme?.visualTabletProductIds ?? []
  if (variant === 'laptop') return theme?.visualLaptopProductIds ?? []
  return theme?.visualProductIds ?? []
}

function visualCmsSlugsForVariant(
  theme: PartnerWebsiteTheme | null | undefined,
  variant: VisualDeviceVariant
): string[] {
  if (variant === 'mobile') return theme?.visualMobileCmsSlugs ?? []
  if (variant === 'tablet') return theme?.visualTabletCmsSlugs ?? []
  if (variant === 'laptop') return theme?.visualLaptopCmsSlugs ?? []
  return theme?.visualCmsSlugs ?? []
}

function visualHomeFlagForVariant(
  theme: PartnerWebsiteTheme | null | undefined,
  variant: VisualDeviceVariant
): boolean {
  if (variant === 'mobile') return Boolean(theme?.useVisualMobileHtml)
  if (variant === 'tablet') return Boolean(theme?.useVisualTabletHtml)
  if (variant === 'laptop') return Boolean(theme?.useVisualLaptopHtml)
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

function looksLikeSavedVisualDocument(html: string): boolean {
  return (
    html.trim().length >= 40 &&
    (htmlHasPartnerVisualChrome(html) ||
      /\bdata-pw-(?:page|edit-device|coordinate-version|region)=/i.test(html))
  )
}

function pickDesktopHomeHtml(website: VisualWebsitePick): string {
  const source = website.htmlSource?.trim() || ''
  const indexHtml =
    extractIndexHtml(website.project ?? { entryPath: 'index.html', files: [] })?.trim() || ''
  // `project/index.html` is the canonical Sửa nhanh file. `htmlSource` is a
  // compatibility mirror and may be stale/corrupted by an older save of a
  // different page or device, so it must never override a usable visual index.
  if (
    indexHtml.length >= 40 &&
    looksLikeVisualHomeHtml(indexHtml) &&
    looksLikeSavedVisualDocument(indexHtml)
  ) {
    return indexHtml
  }
  if (source.length >= 40 && looksLikeVisualHomeHtml(source)) return source
  if (indexHtml.length >= 40) return indexHtml
  return looksLikeVisualHomeHtml(source) ? source : ''
}

function readVisualHtmlFile(
  website: VisualWebsitePick,
  pageKey: PartnerWebsitePageKey,
  variant: VisualDeviceVariant
): string {
  const htmlPath = visualEditorHtmlPath(pageKey, variant)
  const file = website.project?.files.find((f) => f.path === htmlPath && f.kind === 'html')
  return file?.content?.trim() || ''
}

function readExactVisualPageHtml(
  website: VisualWebsitePick,
  pageKey: PartnerWebsitePageKey,
  variant: VisualDeviceVariant = 'desktop'
): string {
  if (pageKey === 'home' && variant === 'desktop') {
    const picked = pickDesktopHomeHtml(website)
    if (website.theme?.useVisualHtml) return picked
    return htmlHasPartnerVisualChrome(picked) ? picked : ''
  }
  if (pageKey === 'home' && variant !== 'desktop') {
    const file = readVisualHtmlFile(website, 'home', variant)
    if (file.length >= 40 && (visualHomeFlagForVariant(website.theme, variant) || htmlHasPartnerVisualChrome(file))) {
      return file
    }
    return ''
  }
  const keys = visualPageKeysForVariant(website.theme, variant)
  const file = readVisualHtmlFile(website, pageKey, variant)
  if (keys.includes(pageKey)) return file
  if (looksLikeSavedVisualDocument(file)) return file
  if (pageKey === 'product_detail' && file.length >= 40) return file
  return ''
}

function withCanonicalSharedChrome(
  html: string,
  website: VisualWebsitePick,
  variant: VisualDeviceVariant
): string {
  const trimmed = html.trim()
  if (trimmed.length < 40) return html
  const homeRaw = readExactVisualPageHtml(website, 'home', variant)
  if (homeRaw.length < 40) return html
  const home = isolateVisualHtmlForDevice(homeRaw, variant)
  const chrome = fillMissingSharedChromeFloats(
    extractSharedChrome(home.length >= 40 ? home : homeRaw),
    homeRaw
  )
  if (!hasSharedChrome(chrome)) return html
  const next = applySharedChrome(trimmed, chrome, { targetVariant: variant })
  return mergeVisualHomeStylesIntoHtml(next, preferredVisualHomeStyleSource(home, homeRaw))
}

export function resolveExactVisualPageHtml(
  website: VisualWebsitePick,
  pageKey: PartnerWebsitePageKey,
  variant: VisualDeviceVariant = 'desktop'
): string {
  const raw = readExactVisualPageHtml(website, pageKey, variant)
  if (pageKey === 'home') {
    return raw
  }
  if (raw.length < 40) return raw
  return withCanonicalSharedChrome(raw, website, variant)
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

/** Blank out script/style/comment bodies so tag counting never trips on HTML inside JS. */
function maskHtmlForTagScan(html: string): string {
  return html.replace(
    /<!--[\s\S]*?-->|<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi,
    (block) => ' '.repeat(block.length)
  )
}

function closingTagIndex(masked: string, from: number, tag: string): number {
  const re = new RegExp(`<${tag}\\b[^>]*>|</${tag}\\s*>`, 'gi')
  re.lastIndex = from
  let depth = 1
  let match: RegExpExecArray | null
  while ((match = re.exec(masked))) {
    if (match[0][1] === '/') {
      depth -= 1
      if (depth === 0) return match.index
      continue
    }
    if (!/\/>$/.test(match[0])) depth += 1
  }
  return -1
}

/**
 * Depth-aware so the slice survives whatever sits after the wrapper. The public page appends
 * runtime scripts before `</body>`, so a lookahead for `</div></body>` silently missed the
 * mobile wrapper and the viewer fell back to the desktop slice.
 */
function extractDeviceWrapperBody(html: string, variant: VisualDeviceVariant): string {
  const body = extractHtmlParts(html).body
  if (!body.trim()) return ''
  const masked = maskHtmlForTagScan(body)
  const isTarget = new RegExp(`\\bdata-pw-visual-device="${variant}"`, 'i')
  const tagRe = /<div\b[^>]*>|<\/div\s*>/gi
  let depth = 0
  let match: RegExpExecArray | null
  while ((match = tagRe.exec(masked))) {
    const token = match[0]
    if (token.startsWith('</')) {
      depth -= 1
      continue
    }
    if (depth === 0 && isTarget.test(token)) {
      const start = match.index + token.length
      const end = closingTagIndex(masked, start, 'div')
      if (end < 0) return ''
      return body.slice(start, end).trim()
    }
    if (!/\/>$/.test(token)) depth += 1
  }
  return ''
}

/** Only top-level device wrappers make a composed page; nested chrome wrappers are normal content. */
function hasDeviceWrappers(html: string): boolean {
  return VISUAL_DEVICE_VARIANTS.some((device) => Boolean(extractDeviceWrapperBody(html, device)))
}

/** Split rules only make sense on a composed page; on one device file they hide real widgets. */
function stripDeviceSplitCss(html: string): string {
  return html.replace(/<style id="pw-visual-device-split">[\s\S]*?<\/style>/gi, '')
}

function rebuildStandaloneHtml(sourceHtml: string, body: string): string {
  const parts = extractHtmlParts(sourceHtml)
  const head = stripDeviceSplitCss(parts.head)
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

/**
 * Attribute order in saved HTML is not fixed, so match the widget first and read its attributes
 * instead of requiring `data-pw-chrome-added` to precede `data-pw-device`.
 */
function stampVisualSearchChrome(html: string, variant: VisualDeviceVariant): string {
  return html.replace(/<div\b[^>]*>/gi, (full) => {
    if (
      !/\bdata-pw-el=["']search["']/i.test(full) &&
      !/\bpw-header-search\b/.test(full) &&
      !/\bpw-shop-search-wrap\b/.test(full)
    ) {
      return full
    }
    if (/\bdata-pw-device=["']/.test(full)) {
      return full.replace(/\bdata-pw-device=["'][^"']*["']/i, `data-pw-device="${variant}"`)
    }
    if (/\bdata-pw-chrome-added="1"/i.test(full)) {
      return full.replace(/>$/, ` data-pw-device="${variant}">`)
    }
    return full
  })
}

function htmlAttrsWithoutEditDevice(attrs: string): string {
  return String(attrs || '')
    .replace(/\sdata-pw-edit-device=(["'])[^"']*\1/gi, '')
    .replace(/\sdata-pw-scene-lock=(["'])[^"']*\1/gi, '')
}

function stampHtmlEditDevice(html: string, variant: VisualDeviceVariant): string {
  if (!/<html\b/i.test(html)) return html
  return html.replace(/<html\b([^>]*)>/i, (_full, attrs: string) => {
    return `<html${htmlAttrsWithoutEditDevice(attrs)} data-pw-edit-device="${variant}" data-pw-scene-lock="${variant}">`
  })
}

const LIVE_READY_CHROME_RE =
  /data-pw-chrome-btn=|data-pw-el=["']cat-toggle["']|data-pw-cat-toggle|[\s"']pw-cat-btn[\s"']|[\s"']pw-shop-cat-btn[\s"']|[\s"']pw-icon-btn[\s"']|[\s"']pw-shop-icon-btn[\s"']|data-pw-chrome-added=/

const VIEWPORT_DOCK_CHROME_RE =
  /(?:pw-bottom-nav|pw-shop-bottom-nav|pw-pdp-sticky|data-pw-pdp-bottom)/i

/** Thanh đáy / PDP sticky là chrome viewport — không lưu tọa độ kéo lên cả thanh. */
export function stripViewportDockChromeGeometry(html: string): string {
  if (!html) return html
  return html.replace(/<(nav|div)(\s[^>]*?)>/gi, (full, tag: string, attrs: string) => {
    if (!VIEWPORT_DOCK_CHROME_RE.test(attrs)) return full
    let next = attrs
      .replace(/\sdata-pw-user-move=["'][^"']*["']/gi, '')
      .replace(/\sdata-pw-stay-scroll=["'][^"']*["']/gi, '')
      .replace(/\sdata-pw-canvas-[xywh]=["'][^"']*["']/gi, '')
      .replace(/\sdata-pw-canvas-[xy]u=["'][^"']*["']/gi, '')
      .replace(/\sdata-pw-placement=["'][^"']*["']/gi, '')
      .replace(/\sdata-pw-box-[xywh]=["'][^"']*["']/gi, '')
      .replace(/\sdata-pw-fixed-(?:x|y|w|h|anchor)=["'][^"']*["']/gi, '')
    next = next.replace(/\sstyle=(["'])([\s\S]*?)\1/i, (_s, quote: string, css: string) => {
      const cleaned = String(css)
        .replace(/(?:^|;)\s*(?:position|left|top|right|bottom|transform|width|height|inset)\s*:[^;]*/gi, '')
        .replace(/^;+|;(?=\s*;)/g, '')
        .replace(/^;+|;+$/g, '')
        .trim()
      return cleaned ? ` style=${quote}${cleaned}${quote}` : ''
    })
    return next === attrs ? full : `<${tag}${next}>`
  })
}

/**
 * Sửa nhanh = gốc. Lưu phải đủ attr live đọc được: máy, chrome-added trên nút đã kéo/đứng im.
 */
export function ensureVisualHtmlLiveReady(html: string, variant?: VisualDeviceVariant): string {
  if (!html) return html
  const ready = html.includes('data-pw-deferred-src')
    ? html.replace(/<img\b([^>]*)\/?>/gi, (_full, attrs: string) => {
        const deferred = attrs.match(/\bdata-pw-deferred-src=(["'])([^"']*)\1/i)
        if (!deferred?.[2]) return `<img${attrs}>`
        const src = deferred[2].replace(/"/g, '&quot;')
        let next = /(?:^|\s)src=/.test(attrs)
          ? attrs.replace(/(?:^|\s)src=(["'])[^"']*\1/i, ` src="${src}"`)
          : ` src="${src}"${attrs}`
        next = next.replace(/\s*data-pw-deferred-src=(["'])[^"']*\1/i, '')
        return `<img${next}>`
      })
    : html
  const stamped = ready.replace(/<(a|button)(\s[^>]*?)>/gi, (full, tag: string, attrs: string) => {
    const moved = /\bdata-pw-user-move=["']1["']/.test(attrs)
    const stay = /\bdata-pw-stay-scroll=["']1["']/.test(attrs)
    const added = /\bdata-pw-chrome-added=["']1["']/.test(attrs)
    const placed = /\bdata-pw-placement=["'](?:scene-absolute|viewport-fixed)["']/.test(attrs)
    if (!LIVE_READY_CHROME_RE.test(attrs)) return full
    if (/\bdata-pw-chrome-kit=/.test(attrs)) {
      let kit = attrs
        .replace(/\sdata-pw-user-move=["'][^"']*["']/gi, '')
        .replace(/\sdata-pw-chrome-added=["'][^"']*["']/gi, '')
        .replace(/\sdata-pw-placement=["'][^"']*["']/gi, '')
        .replace(/\sdata-pw-box-[xywh]=["'][^"']*["']/gi, '')
        .replace(/\sdata-pw-fixed-(?:x|y|w|h)=["'][^"']*["']/gi, '')
      kit = kit.replace(/\sstyle=(["'])([\s\S]*?)\1/i, (_s, quote: string, css: string) => {
        const cleaned = String(css)
          .replace(/(?:^|;)\s*(?:position|left|top|right|bottom|transform)\s*:[^;]*/gi, '')
          .replace(/^;+|;+$/g, '')
          .trim()
        return cleaned ? ` style=${quote}${cleaned}${quote}` : ''
      })
      return kit === attrs ? full : `<${tag}${kit}>`
    }
    if (!(moved || stay || added || placed)) return full
    let next = attrs
    if (placed && !moved) next += ' data-pw-user-move="1"'
    if (!added) next += ' data-pw-chrome-added="1"'
    if (variant && !/\bdata-pw-device=/.test(next)) next += ` data-pw-device="${variant}"`
    return next === attrs ? full : `<${tag}${next}>`
  })
  return stampAuthoredVisualMetricsInHtml(
    dedupeSharedShopHeaders(unwrapPersistedLiveChromeHtml(stripViewportDockChromeGeometry(stamped)))
  )
}

function upsertInlineCssProps(attrs: string, props: Record<string, string>): string {
  const styleMatch = attrs.match(/\sstyle=(["'])([\s\S]*?)\1/i)
  let css = styleMatch?.[2] || ''
  const quote = styleMatch?.[1] || '"'
  for (const [prop, value] of Object.entries(props)) {
    const escaped = prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`(?:^|;)\\s*${escaped}\\s*:[^;]*`, 'i')
    if (re.test(css)) css = css.replace(re, `;${prop}:${value}`)
    else css = `${css};${prop}:${value}`
  }
  css = css.replace(/^;+|;+$/g, '').replace(/;;+/g, ';').trim()
  if (!css) return attrs.replace(/\sstyle=(["'])([\s\S]*?)\1/i, '')
  if (styleMatch) {
    return attrs.replace(/\sstyle=(["'])([\s\S]*?)\1/i, ` style=${quote}${css}${quote}`)
  }
  return `${attrs} style="${css.replace(/"/g, '&quot;')}"`
}

/** Lưu phải giữ --pw-block-h / --pw-image-radius khi đã có attr Sửa nhanh. */
export function stampAuthoredVisualMetricsInHtml(html: string): string {
  if (!html) return html
  return html.replace(/<([a-zA-Z][\w:-]*)(\s[^>]*?)>/g, (full, _tag: string, attrs: string) => {
    if (!/\bdata-pw-(?:block-h|block-w|image-radius)=/.test(attrs)) return full
    const props: Record<string, string> = {}
    const blockH = attrs.match(/\bdata-pw-block-h=["'](\d+)["']/i)?.[1]
    const isGrid =
      /\bdata-pw-added-catalog=/.test(attrs) ||
      /\bdata-pw-featured-categories=/.test(attrs) ||
      /\bdata-pw-region=["']catalog["']/.test(attrs)
    if (blockH && !isGrid) {
      props['--pw-block-h'] = `${blockH}px`
      props['min-height'] = `${blockH}px`
      props.height = `${blockH}px`
    }
    const blockW = attrs.match(/\bdata-pw-block-w=["'](\d+)["']/i)?.[1]
    if (blockW) props['--pw-block-w'] = `${blockW}px`
    const radius = attrs.match(/\bdata-pw-image-radius=["'](\d+)["']/i)?.[1]
    if (radius != null) {
      props['--pw-image-radius'] = `${radius}px`
      props['border-radius'] = `${radius}px`
      if (Number(radius) > 0) props.overflow = 'hidden'
    }
    if (!Object.keys(props).length) return full
    const next = upsertInlineCssProps(attrs, props)
    return next === attrs ? full : full.replace(attrs, next)
  })
}

function stampVisualAddedChrome(html: string, variant: VisualDeviceVariant): string {
  const next = html.replace(
    /<(a|button)\b([^>]*)>([\s\S]*?)<\/\1>/gi,
    (full, tag: string, attrs: string) => {
      if (!/\bdata-pw-chrome-added="1"/i.test(attrs)) return full
      const device = attrs.match(/\bdata-pw-device=["']([^"']*)["']/i)?.[1]
      if (device === variant) return full
      if (device) return chromeCountBadgeKindFromHtmlSnippet(full) ? full : ''
      return full.replace(`<${tag}${attrs}>`, () => `<${tag}${attrs} data-pw-device="${variant}">`)
    }
  )
  return restampChromeCountBadgeWidgets(stampVisualSearchChrome(next, variant), variant)
}

function stampedVisualDeviceOf(html: string): VisualDeviceVariant | null {
  const raw =
    html.match(/<html\b[^>]*\bdata-pw-edit-device=["']([^"']+)["']/i)?.[1]?.trim() ||
    html.match(/<html\b[^>]*\bdata-pw-scene-lock=["']([^"']+)["']/i)?.[1]?.trim()
  if (raw === 'mobile' || raw === 'tablet' || raw === 'laptop' || raw === 'desktop') return raw
  return null
}

/** Lấy đúng một bản Mobile, Tablet hoặc Desktop từ HTML (kể cả trang đã gộp). */
export function isolateVisualHtmlForDevice(
  html: string,
  variant: VisualDeviceVariant,
  opts?: { stripAddedChrome?: boolean }
): string {
  const trimmed = html.trim()
  if (!trimmed) return ''
  const sliced = extractDeviceWrapperBody(trimmed, variant)
  const stamped = stampedVisualDeviceOf(trimmed)
  if (!sliced && !hasDeviceWrappers(trimmed) && stamped && stamped !== variant) {
    // Standalone file already belongs to another machine — never reuse it as this one.
    return ''
  }
  const source = sliced
    ? hoistBodyLevelSceneOverlays(
        hoistBodyLevelSharedChrome(
          hoistBodyLevelChromeFloats(rebuildStandaloneHtml(trimmed, sliced), trimmed, variant),
          trimmed,
          variant
        ),
        trimmed,
        variant
      )
    : hasDeviceWrappers(trimmed)
      ? ''
      : stripDeviceSplitCss(trimmed)
  if (!source) return ''
  const stripped = opts?.stripAddedChrome
    ? stripVisualAddedChrome(source, { keepCountBadges: true })
    : source
  return stampHtmlEditDevice(stampVisualAddedChrome(stripped, variant), variant)
}

function extractHtmlParts(html: string): { head: string; body: string; htmlAttrs: string } {
  const head = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? ''
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html
  const htmlAttrs = html.match(/<html([^>]*)>/i)?.[1] ?? ' lang="vi"'
  return { head, body, htmlAttrs }
}

const VISUAL_TWO_DEVICE_SPLIT_CSS = `.pw-visual-desktop{display:contents}
.pw-visual-mobile{display:none!important}
@media (max-width:767px){
.pw-visual-desktop{display:none!important}
.pw-visual-mobile{display:contents!important}
}
@media (min-width:768px){
[data-pw-chrome-added][data-pw-device="mobile"]:not([data-pw-el="search"]):not(.pw-header-search):not(.pw-shop-search-wrap),
.pw-header-actions [data-pw-chrome-added]:not([data-pw-device="desktop"]):not([data-pw-el="search"]):not(.pw-header-search):not(.pw-shop-search-wrap),
.pw-shop-header-actions [data-pw-chrome-added]:not([data-pw-device="desktop"]):not([data-pw-el="search"]):not(.pw-header-search):not(.pw-shop-search-wrap),
.pw-topbar [data-pw-chrome-added]:not([data-pw-device="desktop"]),
.pw-bottom-nav [data-pw-chrome-added]:not([data-pw-device="desktop"]),
.pw-shop-bottom-nav [data-pw-chrome-added]:not([data-pw-device="desktop"]){display:none!important}
}
@media (max-width:767px){
[data-pw-chrome-added][data-pw-device="desktop"]:not([data-pw-el="search"]):not(.pw-header-search):not(.pw-shop-search-wrap),
[data-pw-chrome-added][data-pw-device="tablet"]:not([data-pw-el="search"]):not(.pw-header-search):not(.pw-shop-search-wrap){display:none!important}
}`

const VISUAL_THREE_DEVICE_SPLIT_CSS = `.pw-visual-desktop,.pw-visual-tablet,.pw-visual-mobile{display:none!important}
@media (max-width:767px){
.pw-visual-mobile{display:contents!important}
}
@media (min-width:768px) and (max-width:1279px){
.pw-visual-tablet{display:contents!important}
[data-pw-chrome-added][data-pw-device="mobile"]:not([data-pw-el="search"]):not(.pw-header-search):not(.pw-shop-search-wrap),
[data-pw-chrome-added][data-pw-device="desktop"]:not([data-pw-el="search"]):not(.pw-header-search):not(.pw-shop-search-wrap){display:none!important}
}
@media (min-width:1280px){
.pw-visual-desktop{display:contents!important}
[data-pw-chrome-added][data-pw-device="mobile"]:not([data-pw-el="search"]):not(.pw-header-search):not(.pw-shop-search-wrap),
[data-pw-chrome-added][data-pw-device="tablet"]:not([data-pw-el="search"]):not(.pw-header-search):not(.pw-shop-search-wrap){display:none!important}
}
@media (max-width:767px){
[data-pw-chrome-added][data-pw-device="desktop"]:not([data-pw-el="search"]):not(.pw-header-search):not(.pw-shop-search-wrap),
[data-pw-chrome-added][data-pw-device="tablet"]:not([data-pw-el="search"]):not(.pw-header-search):not(.pw-shop-search-wrap){display:none!important}
}`

const VISUAL_TABLET_DESKTOP_SPLIT_CSS = `.pw-visual-desktop,.pw-visual-tablet{display:none!important}
@media (max-width:1279px){
.pw-visual-tablet{display:contents!important}
}
@media (min-width:1280px){
.pw-visual-desktop{display:contents!important}
[data-pw-chrome-added][data-pw-device="tablet"]:not([data-pw-el="search"]):not(.pw-header-search):not(.pw-shop-search-wrap){display:none!important}
}
@media (max-width:767px){
[data-pw-chrome-added][data-pw-device="desktop"]:not([data-pw-el="search"]):not(.pw-header-search):not(.pw-shop-search-wrap){display:none!important}
}`

/**
 * Visible `.pw-visual-*` wrappers must be `display:contents` so sticky head /
 * fixed float / dock participate in the page scroll — same Sửa nhanh desktop
 * physics on every storefront and device. Hidden devices stay `display:none`.
 */
export const VISUAL_FOUR_DEVICE_SPLIT_CSS = `.pw-visual-desktop,.pw-visual-laptop,.pw-visual-tablet,.pw-visual-mobile{display:none!important}
@media (max-width:767px){
.pw-visual-mobile{display:contents!important}
html:not(:has(.pw-visual-mobile)) .pw-visual-tablet{display:contents!important}
html:not(:has(.pw-visual-mobile)):not(:has(.pw-visual-tablet)) .pw-visual-laptop{display:contents!important}
html:not(:has(.pw-visual-mobile)):not(:has(.pw-visual-tablet)):not(:has(.pw-visual-laptop)) .pw-visual-desktop{display:contents!important}
}
@media (min-width:768px) and (max-width:1279px){
.pw-visual-tablet{display:contents!important}
html:not(:has(.pw-visual-tablet)) .pw-visual-laptop{display:contents!important}
html:not(:has(.pw-visual-tablet)):not(:has(.pw-visual-laptop)) .pw-visual-desktop{display:contents!important}
}
@media (min-width:1280px) and (max-width:1439px){
.pw-visual-laptop{display:contents!important}
html:not(:has(.pw-visual-laptop)) .pw-visual-desktop{display:contents!important}
}
@media ${pwScaledFhdDesktopMediaQuery()}{
.pw-visual-laptop{display:none!important}
.pw-visual-desktop{display:contents!important}
html:not(:has(.pw-visual-desktop)) .pw-visual-laptop{display:contents!important}
}
@media (min-width:1440px){
.pw-visual-desktop{display:contents!important}
html:not(:has(.pw-visual-desktop)) .pw-visual-laptop{display:contents!important}
}`

/** One document: desktop + laptop + tablet + mobile bodies, shown via CSS breakpoint. */
export function composeResponsiveVisualHtml(
  desktopHtml: string,
  mobileHtml: string,
  tabletHtml = '',
  laptopHtml = ''
): string {
  const desktopRaw = desktopHtml.trim()
  const mobileRaw = mobileHtml.trim()
  const tabletRaw = tabletHtml.trim()
  const laptopRaw = laptopHtml.trim()
  const desktop = isolateVisualHtmlForDevice(desktopRaw, 'desktop')
  const mobile = isolateVisualHtmlForDevice(mobileRaw, 'mobile')
  const tablet = isolateVisualHtmlForDevice(tabletRaw, 'tablet')
  const laptop = isolateVisualHtmlForDevice(laptopRaw, 'laptop')
  if (desktop.length >= 40 && mobile.length < 40 && tablet.length < 40 && laptop.length < 40) return desktop
  if (mobile.length >= 40 && desktop.length < 40 && tablet.length < 40 && laptop.length < 40) return mobile
  if (tablet.length >= 40 && desktop.length < 40 && mobile.length < 40 && laptop.length < 40) return tablet
  if (laptop.length >= 40 && desktop.length < 40 && mobile.length < 40 && tablet.length < 40) return laptop
  if (desktop.length < 40 && mobile.length < 40 && tablet.length < 40 && laptop.length < 40) return ''
  const hasMobile = mobile.length >= 40
  const hasTablet = tablet.length >= 40
  const hasLaptop = laptop.length >= 40
  const d = extractHtmlParts(desktop)
  const m = extractHtmlParts(hasMobile ? mobile : desktop)
  const t = hasTablet ? extractHtmlParts(tablet) : null
  const l = hasLaptop ? extractHtmlParts(laptop) : null
  const splitCss = hasLaptop
    ? VISUAL_FOUR_DEVICE_SPLIT_CSS
    : hasTablet
      ? hasMobile
        ? VISUAL_THREE_DEVICE_SPLIT_CSS
        : VISUAL_TABLET_DESKTOP_SPLIT_CSS
      : VISUAL_TWO_DEVICE_SPLIT_CSS
  const extraHead = [hasLaptop ? l?.head || '' : '', hasTablet ? t?.head || '' : '', hasMobile ? m.head : '']
    .filter(Boolean)
    .join('\n')
  const laptopBlock = hasLaptop
    ? `<div class="pw-visual-laptop" data-pw-visual-device="laptop">${l?.body || ''}</div>`
    : ''
  const tabletBlock = hasTablet
    ? `<div class="pw-visual-tablet" data-pw-visual-device="tablet">${t?.body || ''}</div>`
    : ''
  const mobileBlock = hasMobile
    ? `<div class="pw-visual-mobile" data-pw-visual-device="mobile">${m.body}</div>`
    : ''
  return `<!DOCTYPE html>
<html${htmlAttrsWithoutEditDevice(d.htmlAttrs || ' lang="vi"')}>
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
${laptopBlock}
${tabletBlock}
${mobileBlock}
</body>
</html>`
}

/**
 * Xem một máy (`?pw-device=`) = đúng file đã lưu của máy đó. Không gộp rồi tách lại: bản gộp phải
 * dựng thêm một bản máy khác (đã gỡ widget Sửa nhanh), nên trang xem dễ hiện thiếu nút.
 */
export function servePublicOneDeviceVisualHtml(
  html: string,
  variant: VisualDeviceVariant,
  theme?: PartnerWebsiteTheme | null
): string {
  const out = injectPartnerShopChromeLayoutCss(
    isolateVisualHtmlForDevice(stripEmptyLogoPlaceholdersFromHtml(html), variant)
  )
  return theme ? rewriteThemeCssVarsInHtml(out, theme) : out
}

function servePublicAvailableDeviceHtml(
  exact: Partial<Record<VisualDeviceVariant, string>>,
  requested: VisualDeviceVariant,
  theme?: PartnerWebsiteTheme | null
): string {
  const html = exact[requested]?.trim() || ''
  return html.length >= 40 ? servePublicOneDeviceVisualHtml(html, requested, theme) : ''
}

export function resolvePublicVisualPageHtml(
  website: VisualWebsitePick,
  pageKey: PartnerWebsitePageKey,
  variant?: VisualDeviceVariant | null
): string {
  const exact = Object.fromEntries(
    VISUAL_DEVICE_VARIANTS.map((device) => [
      device,
      resolveExactVisualPageHtml(website, pageKey, device),
    ])
  ) as Partial<Record<VisualDeviceVariant, string>>
  return servePublicAvailableDeviceHtml(exact, variant || 'desktop', website.theme)
}

export function resolveExactVisualCategoryHtml(
  website: VisualWebsitePick,
  categoryPath: string,
  variant: VisualDeviceVariant = 'desktop'
): string {
  const path = normalizeVisualCategoryPath(categoryPath)
  if (!path) return ''
  const keys = visualCategoryPathsForVariant(website.theme, variant)
  const htmlPath = categoryVisualHtmlPath(path, variant)
  const file = website.project?.files.find((f) => f.path === htmlPath && f.kind === 'html')
  const raw = file?.content?.trim() || ''
  if (raw.length < 40) return ''
  if (!keys.includes(path) && !looksLikeSavedVisualDocument(raw)) return ''
  return withCanonicalSharedChrome(raw, website, variant)
}

export function resolvePublicVisualCategoryHtml(
  website: VisualWebsitePick,
  categoryPath: string,
  variant?: VisualDeviceVariant | null
): string {
  const exact = Object.fromEntries(
    VISUAL_DEVICE_VARIANTS.map((device) => [
      device,
      resolveExactVisualCategoryHtml(website, categoryPath, device),
    ])
  ) as Partial<Record<VisualDeviceVariant, string>>
  return servePublicAvailableDeviceHtml(exact, variant || 'desktop', website.theme)
}

function readProductVisualFile(
  website: VisualWebsitePick,
  productId: string,
  variant: VisualDeviceVariant
): string {
  const htmlPath = productVisualHtmlPath(productId, variant)
  const file = website.project?.files.find((f) => f.path === htmlPath && f.kind === 'html')
  return file?.content?.trim() || ''
}

function firstDeviceProductVisualHtml(
  website: VisualWebsitePick,
  variant: VisualDeviceVariant
): string {
  for (const id of visualProductIdsForVariant(website.theme, variant)) {
    const raw = readProductVisualFile(website, id, variant)
    if (raw.length >= 40) return raw
  }
  return ''
}

function inferVisualHtmlContext(html: string): {
  locale: WebLocale
  siteSlug: string
  title: string
} {
  const locale = normalizeWebLocale(html.match(/<html\b[^>]*\blang=["']([^"']+)["']/i)?.[1]) ?? 'vi'
  const siteSlug = html.match(/\/site\/([a-z0-9][a-z0-9-]{1,80})(?:\/|"|')/i)?.[1] || ''
  const title =
    html.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim() ||
    html.match(/\bdata-pw-el=["']wordmark["'][^>]*>([^<]+)/i)?.[1]?.trim() ||
    ''
  return { locale, siteSlug, title }
}

function fallbackPdpShellFromHomeChrome(
  website: VisualWebsitePick,
  variant: VisualDeviceVariant
): string {
  const home = resolveExactVisualPageHtml(website, 'home', variant).trim()
  if (home.length < 40 || !htmlHasPartnerVisualChrome(home)) return ''
  const ctx = inferVisualHtmlContext(home)
  const shell = buildDefaultDemoPdpShellHtml({
    locale: ctx.locale,
    siteSlug: ctx.siteSlug,
    variant,
    title: ctx.title || undefined,
    logoUrl: website.theme?.logoUrl,
  })
  return withCanonicalSharedChrome(shell, website, variant)
}

/** Shared PDP layout for Sửa nhanh — one page per device, not per inventory id. */
export function resolveVisualPdpShellHtml(
  website: VisualWebsitePick,
  variant: VisualDeviceVariant = 'desktop'
): string {
  const shell = readExactVisualPageHtml(website, 'product_detail', variant).trim()
  if (shell.length >= 40) return withCanonicalSharedChrome(shell, website, variant)
  const shared = firstDeviceProductVisualHtml(website, variant)
  if (shared.length >= 40) return withCanonicalSharedChrome(shared, website, variant)
  return fallbackPdpShellFromHomeChrome(website, variant)
}

export function resolveExactVisualProductHtml(
  website: VisualWebsitePick,
  productId: string,
  variant: VisualDeviceVariant = 'desktop'
): string {
  const shared = resolveVisualPdpShellHtml(website, variant)
  if (shared.length >= 40) return shared
  const id = normalizeVisualProductId(productId)
  if (!id) return ''
  const raw = readProductVisualFile(website, id, variant)
  if (raw.length < 40) return ''
  return withCanonicalSharedChrome(raw, website, variant)
}

export function resolvePublicVisualProductHtml(
  website: VisualWebsitePick,
  productId: string,
  variant?: VisualDeviceVariant | null
): string {
  const exact = Object.fromEntries(
    VISUAL_DEVICE_VARIANTS.map((device) => [
      device,
      resolveExactVisualProductHtml(website, productId, device),
    ])
  ) as Partial<Record<VisualDeviceVariant, string>>
  return servePublicAvailableDeviceHtml(exact, variant || 'desktop', website.theme)
}

export function resolveExactVisualCmsHtml(
  website: VisualWebsitePick,
  cmsSlug: string,
  variant: VisualDeviceVariant = 'desktop'
): string {
  const slug = normalizeVisualCmsSlug(cmsSlug)
  if (!slug) return ''
  const keys = visualCmsSlugsForVariant(website.theme, variant)
  const htmlPath = cmsVisualHtmlPath(slug, variant)
  const file = website.project?.files.find((f) => f.path === htmlPath && f.kind === 'html')
  const raw = file?.content?.trim() || ''
  if (raw.length < 40) return ''
  if (!keys.includes(slug) && !looksLikeSavedVisualDocument(raw)) return ''
  return withCanonicalSharedChrome(raw, website, variant)
}

export function resolvePublicVisualCmsHtml(
  website: VisualWebsitePick,
  cmsSlug: string,
  variant?: VisualDeviceVariant | null
): string {
  const exact = Object.fromEntries(
    VISUAL_DEVICE_VARIANTS.map((device) => [
      device,
      resolveExactVisualCmsHtml(website, cmsSlug, device),
    ])
  ) as Partial<Record<VisualDeviceVariant, string>>
  return servePublicAvailableDeviceHtml(exact, variant || 'desktop', website.theme)
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
  return { ...project, files }
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
  visualLaptopPageKeys?: PartnerWebsitePageKey[]
  visualCategoryPaths?: string[]
  visualMobileCategoryPaths?: string[]
  visualTabletCategoryPaths?: string[]
  visualLaptopCategoryPaths?: string[]
  visualProductIds?: string[]
  visualMobileProductIds?: string[]
  visualTabletProductIds?: string[]
  visualLaptopProductIds?: string[]
  visualCmsSlugs?: string[]
  visualMobileCmsSlugs?: string[]
  visualTabletCmsSlugs?: string[]
  visualLaptopCmsSlugs?: string[]
}): PartnerWebsiteProject {
  const desktopKeys = input.visualPageKeys ?? []
  const mobileKeys = input.visualMobilePageKeys ?? []
  const tabletKeys = input.visualTabletPageKeys ?? normalizeVisualPageKeys(input.theme.visualTabletPageKeys)
  const laptopKeys = input.visualLaptopPageKeys ?? normalizeVisualPageKeys(input.theme.visualLaptopPageKeys)
  const categoryPaths = input.visualCategoryPaths ?? []
  const mobileCategoryPaths = input.visualMobileCategoryPaths ?? []
  const tabletCategoryPaths =
    input.visualTabletCategoryPaths ?? normalizeVisualCategoryPaths(input.theme.visualTabletCategoryPaths)
  const laptopCategoryPaths =
    input.visualLaptopCategoryPaths ?? normalizeVisualCategoryPaths(input.theme.visualLaptopCategoryPaths)
  const productIds = input.visualProductIds ?? []
  const mobileProductIds = input.visualMobileProductIds ?? []
  const tabletProductIds =
    input.visualTabletProductIds ?? normalizeVisualProductIds(input.theme.visualTabletProductIds)
  const laptopProductIds =
    input.visualLaptopProductIds ?? normalizeVisualProductIds(input.theme.visualLaptopProductIds)
  const cmsSlugs = input.visualCmsSlugs ?? []
  const mobileCmsSlugs = input.visualMobileCmsSlugs ?? []
  const tabletCmsSlugs = input.visualTabletCmsSlugs ?? normalizeVisualCmsSlugs(input.theme.visualTabletCmsSlugs)
  const laptopCmsSlugs = input.visualLaptopCmsSlugs ?? normalizeVisualCmsSlugs(input.theme.visualLaptopCmsSlugs)
  const keepPaths = new Set<string>([
    ...desktopKeys.map((key) => visualEditorHtmlPath(key, 'desktop')),
    ...mobileKeys.map((key) => visualEditorHtmlPath(key, 'mobile')),
    ...tabletKeys.map((key) => visualEditorHtmlPath(key, 'tablet')),
    ...laptopKeys.map((key) => visualEditorHtmlPath(key, 'laptop')),
    ...categoryPaths.map((p) => categoryVisualHtmlPath(p, 'desktop')),
    ...mobileCategoryPaths.map((p) => categoryVisualHtmlPath(p, 'mobile')),
    ...tabletCategoryPaths.map((p) => categoryVisualHtmlPath(p, 'tablet')),
    ...laptopCategoryPaths.map((p) => categoryVisualHtmlPath(p, 'laptop')),
    ...productIds.map((id) => productVisualHtmlPath(id, 'desktop')),
    ...mobileProductIds.map((id) => productVisualHtmlPath(id, 'mobile')),
    ...tabletProductIds.map((id) => productVisualHtmlPath(id, 'tablet')),
    ...laptopProductIds.map((id) => productVisualHtmlPath(id, 'laptop')),
    ...cmsSlugs.map((s) => cmsVisualHtmlPath(s, 'desktop')),
    ...mobileCmsSlugs.map((s) => cmsVisualHtmlPath(s, 'mobile')),
    ...tabletCmsSlugs.map((s) => cmsVisualHtmlPath(s, 'tablet')),
    ...laptopCmsSlugs.map((s) => cmsVisualHtmlPath(s, 'laptop')),
    ...(input.theme.useVisualHtml ? ['index.html'] : []),
    ...(input.theme.useVisualMobileHtml ? ['index.mobile.html'] : []),
    ...(input.theme.useVisualTabletHtml ? ['index.tablet.html'] : []),
    ...(input.theme.useVisualLaptopHtml ? ['index.laptop.html'] : []),
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
      return { ...f, content: rewriteThemeCssVarsInHtml(content, input.theme) }
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
  if (rest === '/login') return null
  if (rest.startsWith('/account')) return 'account'
  if (rest === '/orders') return 'orders'
  if (rest === '/addresses') return 'addresses'
  if (rest.startsWith('/products/') && rest !== '/products') return 'product_detail'
  if (rest === '/c' || rest.startsWith('/c/')) return 'collection'
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
