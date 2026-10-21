/**
 * Chân trang mobile: vuốt ngang mọi tính năng.
 * Cụm giữa là tính năng liên quan rồi tới tính năng vừa xem.
 */
import { notifyFeatureUsage } from '@/lib/feature-usage-signal'
import type { ToolKey } from '@/lib/i18n/dictionaries'
import {
  CREATION_SIDEBAR_POPULAR_LINKS,
  getCreationRelatedLinks,
} from '@/lib/creation-tool-sidebar-config'
import { AI_TOOLS, NAV_GROUPS } from '@/lib/nav-config'

export const MOBILE_RECENT_FEATURES_KEY = 'nanoai_recent_features_v1'
export const MOBILE_FEATURE_VISIT_COUNTS_KEY = 'nanoai_feature_visit_counts_v1'
const MAX_RECENT = 12

export type MobileFeatureDockKind = 'current' | 'recent' | 'related' | 'popular' | 'frequent' | 'catalog'

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

export function readFeatureVisitCounts(): Record<string, number> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(MOBILE_FEATURE_VISIT_COUNTS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const counts: Record<string, number> = {}
    for (const [key, value] of Object.entries(parsed)) {
      const feature = resolveCatalogFeature(key)
      if (!feature || typeof value !== 'number' || !Number.isFinite(value) || value <= 0) continue
      counts[feature.href] = (counts[feature.href] ?? 0) + Math.floor(value)
    }
    return counts
  } catch {
    return {}
  }
}

/** Cùng một lần mở chỉ cộng một lần, dù thanh đáy và menu cùng ghi nhận. */
let lastCountedHref: string | null = null

function bumpFeatureVisitCount(href: string) {
  if (lastCountedHref === href) return
  lastCountedHref = href
  const counts = readFeatureVisitCounts()
  counts[href] = (counts[href] ?? 0) + 1
  try {
    window.localStorage.setItem(MOBILE_FEATURE_VISIT_COUNTS_KEY, JSON.stringify(counts))
  } catch {
    /* ignore */
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
  bumpFeatureVisitCount(feature.href)
  notifyFeatureUsage()
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

/**
 * Lưới danh mục, từ trên xuống:
 * vừa mở (mới nhất trước), rồi tính năng hay xem nhất, rồi phần chưa mở theo catalog.
 */
export function buildMobileFeatureGrid(
  pathname: string,
  recentHrefs: readonly string[],
  visitCounts: Readonly<Record<string, number>> = {}
): { lead: MobileFeatureDockItem[]; rest: MobileFeatureDockItem[] } {
  const catalog = catalogFeatures()
  const byHref = new Map(catalog.map((feature) => [feature.href, feature]))
  const seen = new Set<string>()
  const lead: MobileFeatureDockItem[] = []
  const pushLead = (href: string, kind: 'recent' | 'frequent') => {
    const feature = byHref.get(normalizeFeaturePath(href))
    if (!feature || seen.has(feature.href)) return
    seen.add(feature.href)
    lead.push({ href: feature.href, labelKey: feature.labelKey, kind })
  }

  const current = resolveCatalogFeature(pathname)
  if (current) pushLead(current.href, 'recent')
  for (const href of recentHrefs) pushLead(href, 'recent')

  const frequent = catalog
    .map((feature, index) => ({ feature, index, count: visitCounts[feature.href] ?? 0 }))
    .filter((row) => row.count > 0 && !seen.has(row.feature.href))
    .sort((a, b) => b.count - a.count || a.index - b.index)
  for (const row of frequent) pushLead(row.feature.href, 'frequent')

  const rest: MobileFeatureDockItem[] = []
  for (const feature of catalog) {
    if (seen.has(feature.href)) continue
    rest.push({ href: feature.href, labelKey: feature.labelKey, kind: 'catalog' })
  }
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
