/**
 * Icon trang chủ: mỗi nhóm một thẻ.
 * Nhóm có tính năng vừa mở hoặc hay mở nổi lên trên.
 * Trong nhóm, icon đã dùng đứng trước, rồi mục liên quan cùng nhóm, rồi phần còn lại theo catalog.
 */
import { getExplicitCreationRelatedLinks } from '@/lib/creation-tool-sidebar-config'
import { toolFeatureKey } from '@/lib/hub-chat/hub-feature-catalog'
import {
  recentFeatureKeysFromThreads,
  type HubFeatureUsageThread,
} from '@/lib/hub-chat/hub-feature-picker-rank'
import type { WebLocale } from '@/lib/i18n/config'
import { normalizeFeaturePath } from '@/lib/mobile-feature-dock'
import type { NavGroupConfig, NavGroupLinkItem } from '@/lib/nav-config'

/** Chip vừa bấm, rồi hội thoại mới nhất, rồi trang đã mở. */
export function homepageRecentKeys(input: {
  sessionKeys: readonly string[]
  threads: readonly HubFeatureUsageThread[]
  visitedHrefs: readonly string[]
  locale: WebLocale
}): string[] {
  return [
    ...input.sessionKeys,
    ...recentFeatureKeysFromThreads(input.threads, input.locale),
    ...input.visitedHrefs,
  ]
}

function rememberKey(keys: string[], known: ReadonlySet<string>, raw: string) {
  const trimmed = raw.trim()
  if (!trimmed) return
  const key = known.has(trimmed)
    ? trimmed
    : toolFeatureKey(normalizeFeaturePath(trimmed.startsWith('tool:') ? trimmed.slice('tool:'.length) : trimmed))
  if (!known.has(key) || keys.includes(key)) return
  keys.push(key)
}

function orderGroupLinks(
  links: readonly NavGroupLinkItem[],
  orderedHrefs: readonly string[]
): NavGroupLinkItem[] {
  const remaining = [...links]
  const placed: NavGroupLinkItem[] = []
  const take = (href: string) => {
    const want = normalizeFeaturePath(href)
    const index = remaining.findIndex((link) => normalizeFeaturePath(link.href) === want)
    if (index < 0) return
    const [link] = remaining.splice(index, 1)
    placed.push(link)
  }
  for (const href of orderedHrefs) {
    if (!remaining.some((link) => normalizeFeaturePath(link.href) === normalizeFeaturePath(href))) continue
    take(href)
    for (const related of getExplicitCreationRelatedLinks(href)) take(related.href)
  }
  return [...placed, ...remaining]
}

export function personalizeHomepageGroups(
  groups: readonly NavGroupConfig[],
  recentKeys: readonly string[],
  visitCounts: Readonly<Record<string, number>> = {}
): NavGroupConfig[] {
  const byKey = new Map<string, NavGroupLinkItem>()
  const visible: NavGroupConfig[] = []
  for (const group of groups) {
    const links = group.links.filter((link) => link.showOnHomepage !== false)
    if (links.length === 0) continue
    for (const link of links) byKey.set(toolFeatureKey(normalizeFeaturePath(link.href)), link)
    visible.push({ titleKey: group.titleKey, links })
  }

  const known = new Set(byKey.keys())
  const orderedKeys: string[] = []
  for (const raw of recentKeys) rememberKey(orderedKeys, known, raw)
  const frequent = [...byKey.entries()]
    .map(([key, link], index) => ({
      key,
      index,
      count: visitCounts[normalizeFeaturePath(link.href)] ?? 0,
    }))
    .filter((row) => row.count > 0 && !orderedKeys.includes(row.key))
    .sort((a, b) => b.count - a.count || a.index - b.index)
  for (const row of frequent) rememberKey(orderedKeys, known, row.key)
  const orderedHrefs = orderedKeys.map((key) => normalizeFeaturePath(byKey.get(key)!.href))
  const rankOf = new Map(orderedHrefs.map((href, index) => [href, index]))

  const ranked = visible.map((group, catalogIndex) => {
    const links = orderGroupLinks(group.links, orderedHrefs)
    let best = Number.POSITIVE_INFINITY
    for (const link of links) {
      const rank = rankOf.get(normalizeFeaturePath(link.href))
      if (rank != null && rank < best) best = rank
    }
    return { titleKey: group.titleKey, links, catalogIndex, best }
  })
  ranked.sort((a, b) => {
    const aUnused = !Number.isFinite(a.best)
    const bUnused = !Number.isFinite(b.best)
    if (aUnused !== bUnused) return aUnused ? 1 : -1
    if (!aUnused && a.best !== b.best) return a.best - b.best
    return a.catalogIndex - b.catalogIndex
  })
  return ranked.map(({ titleKey, links }) => ({ titleKey, links }))
}
