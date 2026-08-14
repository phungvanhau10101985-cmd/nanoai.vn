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

export type VisualDeviceVariant = 'desktop' | 'mobile'

export function visualEditorDeviceVariant(
  device: 'mobile' | 'tablet' | 'laptop' | 'desktop'
): VisualDeviceVariant {
  return device === 'mobile' ? 'mobile' : 'desktop'
}

export function visualEditorHtmlPath(
  pageKey: PartnerWebsitePageKey,
  variant: VisualDeviceVariant = 'desktop'
): string {
  const base = getPartnerWebsitePageDef(pageKey)?.htmlPath ?? 'index.html'
  if (variant === 'mobile') return base.replace(/\.html$/i, '.mobile.html')
  return base
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
  if (!p || p.includes('..')) return variant === 'mobile' ? 'c/_none.mobile.html' : 'c/_none.html'
  return variant === 'mobile' ? `c/${p}.mobile.html` : `c/${p}.html`
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
  if (!id) return variant === 'mobile' ? 'p/_none.mobile.html' : 'p/_none.html'
  return variant === 'mobile' ? `p/${id}.mobile.html` : `p/${id}.html`
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
  if (!slug) return variant === 'mobile' ? 'cms/_none.mobile.html' : 'cms/_none.html'
  return variant === 'mobile' ? `cms/${slug}.mobile.html` : `cms/${slug}.html`
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

export function shouldServeVisualPageHtml(pageKey: PartnerWebsitePageKey): boolean {
  return !VISUAL_HTML_SERVE_EXCLUDED.has(pageKey)
}

type VisualWebsitePick = {
  theme?: Pick<
    PartnerWebsiteTheme,
    | 'useVisualHtml'
    | 'useVisualMobileHtml'
    | 'visualPageKeys'
    | 'visualMobilePageKeys'
    | 'visualCategoryPaths'
    | 'visualMobileCategoryPaths'
    | 'visualProductIds'
    | 'visualMobileProductIds'
    | 'visualCmsSlugs'
    | 'visualMobileCmsSlugs'
  > | null
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
  if (pageKey === 'home' && variant === 'mobile') {
    if (!website.theme?.useVisualMobileHtml) return ''
    const file = website.project?.files.find((f) => f.path === 'index.mobile.html' && f.kind === 'html')
    return file?.content?.trim() || ''
  }
  const keys =
    variant === 'mobile' ? website.theme?.visualMobilePageKeys ?? [] : website.theme?.visualPageKeys ?? []
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

/** Widget thêm bằng Sửa nhanh — gỡ khỏi bản máy kia. */
export function stripVisualAddedChrome(html: string): string {
  return html.replace(/<(a|button)\b[^>]*data-pw-chrome-added="1"[^>]*>[\s\S]*?<\/\1>/gi, '')
}

function stampVisualAddedChrome(html: string, variant: VisualDeviceVariant): string {
  const opposite = variant === 'mobile' ? 'desktop' : 'mobile'
  const withoutOpposite = html.replace(
    new RegExp(
      `<(a|button)\\b[^>]*data-pw-chrome-added="1"[^>]*data-pw-device="${opposite}"[^>]*>[\\s\\S]*?<\\/\\1>`,
      'gi'
    ),
    ''
  )
  return withoutOpposite.replace(
    /<(a|button)\b([^>]*data-pw-chrome-added="1"[^>]*)>/gi,
    (full, tag: string, attrs: string) => {
      if (/\bdata-pw-device=/.test(attrs)) return full
      return `<${tag}${attrs} data-pw-device="${variant}">`
    }
  )
}

/** Lấy đúng một bản Mobile hoặc Desktop từ HTML (kể cả trang đã gộp). */
export function isolateVisualHtmlForDevice(
  html: string,
  variant: VisualDeviceVariant,
  opts?: { stripAddedChrome?: boolean }
): string {
  const trimmed = html.trim()
  if (!trimmed) return ''
  const sliced =
    extractDeviceWrapperBody(trimmed, variant) ||
    (variant === 'mobile' ? extractDeviceWrapperBody(trimmed, 'desktop') : '')
  const source = sliced ? rebuildStandaloneHtml(trimmed, sliced) : trimmed
  if (opts?.stripAddedChrome) return stripVisualAddedChrome(source)
  return stampVisualAddedChrome(source, variant)
}

function extractHtmlParts(html: string): { head: string; body: string; htmlAttrs: string } {
  const head = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? ''
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html
  const htmlAttrs = html.match(/<html([^>]*)>/i)?.[1] ?? ' lang="vi"'
  return { head, body, htmlAttrs }
}

/** One document: desktop + mobile bodies, shown via CSS breakpoint. */
export function composeResponsiveVisualHtml(desktopHtml: string, mobileHtml: string): string {
  const desktopRaw = desktopHtml.trim()
  const mobileRaw = mobileHtml.trim()
  let desktop = isolateVisualHtmlForDevice(desktopRaw, 'desktop')
  const mobile = isolateVisualHtmlForDevice(mobileRaw, 'mobile')
  if (desktop.length >= 40 && mobile.length < 40) return desktop
  if (mobile.length >= 40 && desktop.length < 40) {
    desktop = isolateVisualHtmlForDevice(stripVisualAddedChrome(mobile), 'desktop')
  }
  if (desktop.length < 40 && mobile.length < 40) return ''
  const d = extractHtmlParts(desktop)
  const m = extractHtmlParts(mobile)
  return `<!DOCTYPE html>
<html${d.htmlAttrs || ' lang="vi"'}>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
${d.head}
${m.head}
<style id="pw-visual-device-split">
.pw-visual-desktop{display:block}
.pw-visual-mobile{display:none!important}
@media (max-width:767px){
.pw-visual-desktop{display:none!important}
.pw-visual-mobile{display:block!important}
}
@media (min-width:768px){
[data-pw-chrome-added][data-pw-device="mobile"],
.pw-header-actions [data-pw-chrome-added]:not([data-pw-device="desktop"]),
.pw-shop-header-actions [data-pw-chrome-added]:not([data-pw-device="desktop"]),
.pw-topbar [data-pw-chrome-added]:not([data-pw-device="desktop"]),
.pw-bottom-nav [data-pw-chrome-added]:not([data-pw-device="desktop"]),
.pw-shop-bottom-nav [data-pw-chrome-added]:not([data-pw-device="desktop"]){display:none!important}
}
@media (max-width:767px){
[data-pw-chrome-added][data-pw-device="desktop"]{display:none!important}
}
</style>
</head>
<body>
<div class="pw-visual-desktop" data-pw-visual-device="desktop">${d.body}</div>
<div class="pw-visual-mobile" data-pw-visual-device="mobile">${m.body}</div>
</body>
</html>`
}

function servePublicVisualHtml(desktop: string, mobile: string): string {
  return injectPartnerShopChromeLayoutCss(composeResponsiveVisualHtml(desktop, mobile))
}

export function resolvePublicVisualPageHtml(
  website: VisualWebsitePick,
  pageKey: PartnerWebsitePageKey
): string {
  const desktop = resolveExactVisualPageHtml(website, pageKey, 'desktop')
  const mobile = resolveExactVisualPageHtml(website, pageKey, 'mobile')
  return servePublicVisualHtml(desktop, mobile)
}

export function resolveExactVisualCategoryHtml(
  website: VisualWebsitePick,
  categoryPath: string,
  variant: VisualDeviceVariant = 'desktop'
): string {
  const path = normalizeVisualCategoryPath(categoryPath)
  if (!path) return ''
  const keys =
    variant === 'mobile'
      ? website.theme?.visualMobileCategoryPaths ?? []
      : website.theme?.visualCategoryPaths ?? []
  if (!keys.includes(path)) return ''
  const htmlPath = categoryVisualHtmlPath(path, variant)
  const file = website.project?.files.find((f) => f.path === htmlPath && f.kind === 'html')
  return file?.content?.trim() || ''
}

export function resolvePublicVisualCategoryHtml(website: VisualWebsitePick, categoryPath: string): string {
  const desktop = resolveExactVisualCategoryHtml(website, categoryPath, 'desktop')
  const mobile = resolveExactVisualCategoryHtml(website, categoryPath, 'mobile')
  return servePublicVisualHtml(desktop, mobile)
}

export function resolveExactVisualProductHtml(
  website: VisualWebsitePick,
  productId: string,
  variant: VisualDeviceVariant = 'desktop'
): string {
  const id = normalizeVisualProductId(productId)
  if (!id) return ''
  const keys =
    variant === 'mobile' ? website.theme?.visualMobileProductIds ?? [] : website.theme?.visualProductIds ?? []
  if (!keys.includes(id)) return ''
  const htmlPath = productVisualHtmlPath(id, variant)
  const file = website.project?.files.find((f) => f.path === htmlPath && f.kind === 'html')
  return file?.content?.trim() || ''
}

export function resolvePublicVisualProductHtml(website: VisualWebsitePick, productId: string): string {
  const desktop = resolveExactVisualProductHtml(website, productId, 'desktop')
  const mobile = resolveExactVisualProductHtml(website, productId, 'mobile')
  return servePublicVisualHtml(desktop, mobile)
}

export function resolveExactVisualCmsHtml(
  website: VisualWebsitePick,
  cmsSlug: string,
  variant: VisualDeviceVariant = 'desktop'
): string {
  const slug = normalizeVisualCmsSlug(cmsSlug)
  if (!slug) return ''
  const keys =
    variant === 'mobile' ? website.theme?.visualMobileCmsSlugs ?? [] : website.theme?.visualCmsSlugs ?? []
  if (!keys.includes(slug)) return ''
  const htmlPath = cmsVisualHtmlPath(slug, variant)
  const file = website.project?.files.find((f) => f.path === htmlPath && f.kind === 'html')
  return file?.content?.trim() || ''
}

export function resolvePublicVisualCmsHtml(website: VisualWebsitePick, cmsSlug: string): string {
  const desktop = resolveExactVisualCmsHtml(website, cmsSlug, 'desktop')
  const mobile = resolveExactVisualCmsHtml(website, cmsSlug, 'mobile')
  return servePublicVisualHtml(desktop, mobile)
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

export function preserveAndRecolorVisualPageFiles(input: {
  previous: PartnerWebsiteProject
  next: PartnerWebsiteProject
  theme: PartnerWebsiteTheme
  visualPageKeys?: PartnerWebsitePageKey[]
  visualMobilePageKeys?: PartnerWebsitePageKey[]
  visualCategoryPaths?: string[]
  visualMobileCategoryPaths?: string[]
  visualProductIds?: string[]
  visualMobileProductIds?: string[]
  visualCmsSlugs?: string[]
  visualMobileCmsSlugs?: string[]
}): PartnerWebsiteProject {
  const desktopKeys = input.visualPageKeys ?? []
  const mobileKeys = input.visualMobilePageKeys ?? []
  const categoryPaths = input.visualCategoryPaths ?? []
  const mobileCategoryPaths = input.visualMobileCategoryPaths ?? []
  const productIds = input.visualProductIds ?? []
  const mobileProductIds = input.visualMobileProductIds ?? []
  const cmsSlugs = input.visualCmsSlugs ?? []
  const mobileCmsSlugs = input.visualMobileCmsSlugs ?? []
  const keepPaths = new Set<string>([
    ...desktopKeys.map((key) => visualEditorHtmlPath(key, 'desktop')),
    ...mobileKeys.map((key) => visualEditorHtmlPath(key, 'mobile')),
    ...categoryPaths.map((p) => categoryVisualHtmlPath(p, 'desktop')),
    ...mobileCategoryPaths.map((p) => categoryVisualHtmlPath(p, 'mobile')),
    ...productIds.map((id) => productVisualHtmlPath(id, 'desktop')),
    ...mobileProductIds.map((id) => productVisualHtmlPath(id, 'mobile')),
    ...cmsSlugs.map((s) => cmsVisualHtmlPath(s, 'desktop')),
    ...mobileCmsSlugs.map((s) => cmsVisualHtmlPath(s, 'mobile')),
    ...(input.theme.useVisualMobileHtml ? ['index.mobile.html'] : []),
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
      return { ...f, content: rewriteThemeCssVarsInHtml(f.content, input.theme) }
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
