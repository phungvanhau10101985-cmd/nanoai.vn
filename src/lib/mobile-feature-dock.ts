/**
 * Chân trang mobile: tính năng đang mở, vừa mở, và cùng nhóm với trang hiện tại.
 */
import type { ToolKey } from '@/lib/i18n/dictionaries'
import {
  CREATION_SIDEBAR_POPULAR_LINKS,
  getCreationRelatedLinks,
} from '@/lib/creation-tool-sidebar-config'
import { AI_TOOLS, NAV_GROUPS } from '@/lib/nav-config'

export const MOBILE_RECENT_FEATURES_KEY = 'nanoai_recent_features_v1'
const MAX_RECENT = 12

export type MobileFeatureDockKind = 'current' | 'recent' | 'related' | 'popular'

export type MobileFeatureDockItem = {
  href: string
  labelKey: ToolKey
  kind: MobileFeatureDockKind
}

type CatalogFeature = { href: string; labelKey: ToolKey }

let catalogCache: CatalogFeature[] | null = null

function catalogFeatures(): CatalogFeature[] {
  if (catalogCache) return catalogCache
  const rows: CatalogFeature[] = []
  const seen = new Set<string>()
  const add = (href: string, labelKey: ToolKey) => {
    const path = normalizeFeaturePath(href)
    if (!path || path === '/' || seen.has(path)) return
    seen.add(path)
    rows.push({ href: path, labelKey })
  }
  for (const tool of AI_TOOLS) add(tool.href, tool.labelKey)
  for (const group of NAV_GROUPS) {
    for (const link of group.links) {
      add(link.href, link.labelKey)
      for (const sub of link.subLinks ?? []) add(sub.href, sub.labelKey)
    }
  }
  catalogCache = rows
  return rows
}

export function normalizeFeaturePath(path: string): string {
  const bare = path.split('?')[0]?.split('#')[0] ?? ''
  if (!bare || bare === '/') return '/'
  return bare.replace(/\/$/, '') || '/'
}

/** Khớp đúng href, không thì lấy tiền tố catalog dài nhất. */
export function resolveCatalogFeature(pathname: string): CatalogFeature | null {
  const path = normalizeFeaturePath(pathname)
  if (path === '/') return null
  const rows = catalogFeatures()
  const exact = rows.find((row) => row.href === path)
  if (exact) return exact
  let best: CatalogFeature | null = null
  for (const row of rows) {
    if (!path.startsWith(`${row.href}/`)) continue
    if (!best || row.href.length > best.href.length) best = row
  }
  return best
}

export function readRecentFeatureHrefs(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(MOBILE_RECENT_FEATURES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const hrefs: string[] = []
    for (const item of parsed) {
      if (typeof item !== 'string') continue
      const feature = resolveCatalogFeature(item)
      if (!feature || hrefs.includes(feature.href)) continue
      hrefs.push(feature.href)
      if (hrefs.length >= MAX_RECENT) break
    }
    return hrefs
  } catch {
    return []
  }
}

/** Ghi nhận trang tính năng vừa mở. Trang không thuộc catalog thì giữ nguyên danh sách. */
export function rememberFeatureVisit(pathname: string): string[] {
  const current = readRecentFeatureHrefs()
  const feature = resolveCatalogFeature(pathname)
  if (!feature) return current
  const next = [feature.href, ...current.filter((href) => href !== feature.href)].slice(0, MAX_RECENT)
  try {
    window.localStorage.setItem(MOBILE_RECENT_FEATURES_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  return next
}

export function buildMobileFeatureDock(pathname: string, recentHrefs: readonly string[]): MobileFeatureDockItem[] {
  const path = normalizeFeaturePath(pathname)
  const items: MobileFeatureDockItem[] = []
  const seen = new Set<string>()
  const push = (href: string, labelKey: ToolKey, kind: MobileFeatureDockKind) => {
    const normalized = normalizeFeaturePath(href)
    if (!normalized || normalized === '/' || seen.has(normalized)) return
    seen.add(normalized)
    items.push({ href: normalized, labelKey, kind })
  }

  const current = resolveCatalogFeature(path)
  if (current) push(current.href, current.labelKey, 'current')

  for (const href of recentHrefs) {
    const feature = resolveCatalogFeature(href)
    if (feature) push(feature.href, feature.labelKey, 'recent')
  }

  for (const related of getCreationRelatedLinks(path)) {
    push(related.href, related.labelKey, 'related')
  }

  if (items.length === 0) {
    for (const popular of CREATION_SIDEBAR_POPULAR_LINKS) {
      push(popular.href, popular.labelKey, 'popular')
    }
  }

  return items
}

export function activeMobileFeatureHref(pathname: string, items: readonly MobileFeatureDockItem[]): string | null {
  const path = normalizeFeaturePath(pathname)
  const exact = items.find((item) => item.href === path)
  if (exact) return exact.href
  let best: string | null = null
  for (const item of items) {
    if (!path.startsWith(`${item.href}/`)) continue
    if (!best || item.href.length > best.length) best = item.href
  }
  return best
}
