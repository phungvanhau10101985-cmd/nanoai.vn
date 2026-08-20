import type { PartnerWebsitePageKey } from '@/lib/partner-website/partner-website-page-catalog'
import {
  categoryPathFromSitePath,
  cmsSlugFromSitePath,
  isVisualEditorPageKey,
  pageKeyFromSitePath,
  productKeyFromSitePath,
} from '@/lib/partner-website/visual-editor/visual-editor-pages'
import {
  chromeWidgetHref,
  chromeWidgetLiveHook,
  isVisualEditorChromeWidgetKind,
} from '@/lib/partner-website/visual-editor/chrome-widgets'

export type VisualEditPageTarget =
  | { kind: 'page'; pageKey: PartnerWebsitePageKey }
  | { kind: 'cms'; cmsSlug: string }
  | { kind: 'category'; categoryPath: string }
  | { kind: 'product'; productKey: string }

const SKIP_HREF =
  /^(#|javascript:|mailto:|tel:|data:)/i

function pathnameFromHref(href: string, siteSlug: string): string | null {
  const raw = href.trim()
  if (!raw || SKIP_HREF.test(raw)) return null
  try {
    if (/^https?:\/\//i.test(raw) || raw.startsWith('//')) {
      const url = new URL(raw.startsWith('//') ? `https:${raw}` : raw)
      return url.pathname || '/'
    }
  } catch {
    return null
  }
  const path = raw.split('?')[0]?.split('#')[0] || ''
  if (!path.startsWith('/')) {
    return `/site/${siteSlug}/${path}`
  }
  return path
}

export function visualEditTargetFromHref(href: string, siteSlug: string): VisualEditPageTarget | null {
  const slug = siteSlug.trim()
  if (!slug) return null
  const pathname = pathnameFromHref(href, slug)
  if (!pathname) return null
  const cms = cmsSlugFromSitePath(pathname, slug)
  if (cms) return { kind: 'cms', cmsSlug: cms }
  const cat = categoryPathFromSitePath(pathname, slug)
  if (cat) return { kind: 'category', categoryPath: cat }
  const productKey = productKeyFromSitePath(pathname, slug)
  if (productKey) return { kind: 'product', productKey }
  const pageKey = pageKeyFromSitePath(pathname, slug)
  if (pageKey && isVisualEditorPageKey(pageKey)) return { kind: 'page', pageKey }
  return null
}

export function visualEditTargetFromChromeKind(
  kind: string,
  siteSlug: string
): VisualEditPageTarget | null {
  if (!isVisualEditorChromeWidgetKind(kind)) return null
  if (chromeWidgetLiveHook(kind) !== 'route') return null
  return visualEditTargetFromHref(chromeWidgetHref(kind, siteSlug), siteSlug)
}

export function visualEditTargetFromSelection(input: {
  href?: string | null
  chromeKind?: string | null
  siteSlug?: string | null
  isLogo?: boolean
}): VisualEditPageTarget | null {
  if (input.isLogo) return { kind: 'page', pageKey: 'home' }
  const slug = input.siteSlug?.trim() || ''
  if (!slug) return null
  const fromHref = visualEditTargetFromHref(input.href || '', slug)
  if (fromHref) return fromHref
  return visualEditTargetFromChromeKind(input.chromeKind || '', slug)
}

/** Same values as the Sửa nhanh page <select>. */
export function visualEditSelectValueFromTarget(target: VisualEditPageTarget): string {
  if (target.kind === 'cms') return `cms:${target.cmsSlug}`
  if (target.kind === 'category') return `c:${target.categoryPath}`
  if (target.kind === 'product') return `p:${target.productKey}`
  return target.pageKey
}
