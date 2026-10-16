/**
 * Chân trang mobile: vuốt ngang mọi tính năng.
 * Cụm giữa là tính năng liên quan rồi tới tính năng vừa xem.
 */
import type { ToolKey } from '@/lib/i18n/dictionaries'
import {
  CREATION_SIDEBAR_POPULAR_LINKS,
  getCreationRelatedLinks,
} from '@/lib/creation-tool-sidebar-config'
import { AI_TOOLS, NAV_GROUPS } from '@/lib/nav-config'

export const MOBILE_RECENT_FEATURES_KEY = 'nanoai_recent_features_v1'
const MAX_RECENT = 12

export type MobileFeatureDockKind = 'current' | 'recent' | 'related' | 'popular' | 'catalog'

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
  const focus: MobileFeatureDockItem[] = []
  const seen = new Set<string>()
  const pushFocus = (href: string, labelKey: ToolKey, kind: MobileFeatureDockKind) => {
    const normalized = normalizeFeaturePath(href)
    if (!normalized || normalized === '/' || seen.has(normalized)) return
    seen.add(normalized)
    focus.push({ href: normalized, labelKey, kind })
  }

  for (const related of getCreationRelatedLinks(path)) {
    pushFocus(related.href, related.labelKey, 'related')
  }

  const current = resolveCatalogFeature(path)
  if (current) pushFocus(current.href, current.labelKey, 'current')

  for (const href of recentHrefs) {
    const feature = resolveCatalogFeature(href)
    if (!feature) continue
    pushFocus(feature.href, feature.labelKey, feature.href === current?.href ? 'current' : 'recent')
  }

  if (focus.length === 0) {
    for (const popular of CREATION_SIDEBAR_POPULAR_LINKS) {
      pushFocus(popular.href, popular.labelKey, 'popular')
    }
  }

  const rest: MobileFeatureDockItem[] = []
  for (const feature of catalogFeatures()) {
    if (seen.has(feature.href)) continue
    rest.push({ href: feature.href, labelKey: feature.labelKey, kind: 'catalog' })
  }

  const mid = Math.ceil(rest.length / 2)
  return [...rest.slice(0, mid), ...focus, ...rest.slice(mid)]
}

/** Lưới danh mục: vừa mở rồi liên quan ở trên, phần còn lại theo thứ tự catalog. */
export function buildMobileFeatureGrid(
  pathname: string,
  recentHrefs: readonly string[]
): { lead: MobileFeatureDockItem[]; rest: MobileFeatureDockItem[] } {
  const dock = buildMobileFeatureDock(pathname, recentHrefs)
  const byKind = (kind: MobileFeatureDockKind) => dock.filter((item) => item.kind === kind)
  const lead = [...byKind('recent'), ...byKind('related'), ...byKind('current'), ...byKind('popular')]
  const leadHrefs = new Set(lead.map((item) => item.href))
  const rest = catalogFeatures()
    .filter((feature) => !leadHrefs.has(feature.href))
    .map((feature) => ({ href: feature.href, labelKey: feature.labelKey, kind: 'catalog' as const }))
  return { lead, rest }
}

/** Vị trí cuộn để cụm liên quan + vừa xem nằm giữa khung nhìn. */
export function dockHomeScrollLeft(input: {
  clusterLeft: number
  clusterWidth: number
  seamLeft: number | null
  viewport: number
  maxScroll: number
}): number {
  const { clusterLeft, clusterWidth, seamLeft, viewport, maxScroll } = input
  // Một ô icon. Cụm chỉ nhỉnh hơn màn hình thì vẫn căn cả cụm, không kéo catalog vào giữa.
  const oneIcon = 88
  let left = clusterLeft
  if (viewport > 0 && clusterWidth > 0 && clusterWidth <= viewport + oneIcon) {
    left = clusterLeft - (viewport - clusterWidth) / 2
  } else if (seamLeft != null && seamLeft > clusterLeft) {
    left = seamLeft - viewport / 2
  }
  const max = Number.isFinite(maxScroll) ? Math.max(0, maxScroll) : 0
  if (!Number.isFinite(left)) return 0
  return Math.min(max, Math.max(0, left))
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
