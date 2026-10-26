/**
 * Picker trên trang chủ:
 * tính năng vừa mở đứng trên, tính năng ít mở ở giữa (thứ tự catalog),
 * tính năng liên quan đứng dưới.
 */
import { getExplicitCreationRelatedLinks } from '@/lib/creation-tool-sidebar-config'
import type { HubFeatureCatalogEntry } from '@/lib/hub-chat/hub-feature-catalog'
import { studioFeatureKey, toolFeatureKey } from '@/lib/hub-chat/hub-feature-catalog'
import { matchFeatureFlowByMessage, STANDALONE_REPLACED_BY_STUDIO } from '@/lib/hub-chat/hub-feature-flow-registry'
import { isRetiredStudioPreset } from '@/lib/hub-chat/hub-studio-presets'
import type { WebLocale } from '@/lib/i18n/config'
import { notifyFeatureUsage } from '@/lib/feature-usage-signal'
import { normalizeFeaturePath } from '@/lib/mobile-feature-dock'

export const HUB_PICKER_RECENT_KEYS = 'nanoai_hub_picker_recent_v1'
const MAX_RECENT = 24
/** Nhóm nhỏ (thử đồ, thiết kế trong chat) coi các chip còn lại là liên quan. */
const FAMILY_GROUP_MAX = 6

export type HubFeaturePickerGroup = {
  groupKey: string
  groupLabel: string
  entries: HubFeatureCatalogEntry[]
}

export type HubFeatureUsageThread = {
  presetId?: string | null
  title?: string | null
  projectTitle?: string | null
  firstUserMessage?: string | null
  lastMessagePreview?: string | null
}

type IndexedEntry = HubFeatureCatalogEntry

export function readHubPickerRecentKeys(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(HUB_PICKER_RECENT_KEYS)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const keys: string[] = []
    for (const item of parsed) {
      if (typeof item !== 'string') continue
      const key = item.trim()
      if (!key || keys.includes(key)) continue
      keys.push(key)
      if (keys.length >= MAX_RECENT) break
    }
    return keys
  } catch {
    return []
  }
}

/** Ghi nhận chip vừa bấm. Mới nhất đứng đầu. */
export function rememberHubPickerFeature(key: string): string[] {
  const trimmed = key.trim()
  const current = readHubPickerRecentKeys()
  if (!trimmed) return current
  const next = [trimmed, ...current.filter((item) => item !== trimmed)].slice(0, MAX_RECENT)
  try {
    window.localStorage.setItem(HUB_PICKER_RECENT_KEYS, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  notifyFeatureUsage()
  return next
}

function featureKeyFromMatchText(text: string, locale: WebLocale): string | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  const match = matchFeatureFlowByMessage(trimmed, locale)
  if (!match) return null
  if (match.kind === 'studio') return studioFeatureKey(match.presetId)
  return toolFeatureKey(match.href)
}

/** Thread mới nhất đứng trước. presetId thắng; không có thì đối chiếu tiêu đề / tin cuối. */
export function recentFeatureKeysFromThreads(
  threads: readonly HubFeatureUsageThread[],
  locale: WebLocale
): string[] {
  const keys: string[] = []
  const push = (key: string | null) => {
    if (!key || keys.includes(key)) return
    keys.push(key)
  }
  for (const thread of threads) {
    const presetId = thread.presetId?.trim()
    if (presetId && !isRetiredStudioPreset(presetId)) {
      push(studioFeatureKey(presetId))
      continue
    }
    const fromProject = featureKeyFromMatchText(thread.projectTitle ?? '', locale)
    if (fromProject) {
      push(fromProject)
      continue
    }
    const fromTitle = featureKeyFromMatchText(thread.title ?? '', locale)
    if (fromTitle) {
      push(fromTitle)
      continue
    }
    const fromFirst = featureKeyFromMatchText(thread.firstUserMessage ?? '', locale)
    if (fromFirst) {
      push(fromFirst)
      continue
    }
    push(featureKeyFromMatchText(thread.lastMessagePreview ?? '', locale))
  }
  return keys
}

function catalogKeyForHref(href: string, byHref: ReadonlyMap<string, string>): string | null {
  const path = normalizeFeaturePath(href)
  if (!path || path === '/') return null
  const replaced = STANDALONE_REPLACED_BY_STUDIO[path]
  if (replaced) return studioFeatureKey(replaced)
  const exact = byHref.get(path)
  if (exact) return exact
  let bestHref = ''
  let bestKey: string | null = null
  for (const [candidate, key] of byHref) {
    if (!path.startsWith(`${candidate}/`)) continue
    if (candidate.length > bestHref.length) {
      bestHref = candidate
      bestKey = key
    }
  }
  return bestKey
}

/** Chip vừa bấm, rồi hội thoại, rồi trang đã mở. Trùng thì giữ lần gần hơn. */
export function mergeRecentFeatureKeys(input: {
  sessionKeys: readonly string[]
  threadKeys: readonly string[]
  visitedHrefs: readonly string[]
  entries: readonly HubFeatureCatalogEntry[]
}): string[] {
  const byHref = new Map<string, string>()
  const known = new Set<string>()
  for (const entry of input.entries) {
    known.add(entry.key)
    if (entry.href) byHref.set(normalizeFeaturePath(entry.href), entry.key)
  }
  const keys: string[] = []
  const push = (key: string | null | undefined) => {
    const trimmed = key?.trim() ?? ''
    if (!trimmed || !known.has(trimmed) || keys.includes(trimmed)) return
    keys.push(trimmed)
    if (keys.length >= MAX_RECENT) return
  }
  for (const key of input.sessionKeys) push(key)
  for (const key of input.threadKeys) push(key)
  for (const href of input.visitedHrefs) {
    if (keys.length >= MAX_RECENT) break
    push(catalogKeyForHref(href, byHref))
  }
  return keys
}

function chunkGroups(entries: readonly IndexedEntry[]): HubFeaturePickerGroup[] {
  const groups: HubFeaturePickerGroup[] = []
  for (const entry of entries) {
    const last = groups[groups.length - 1]
    if (last && last.groupKey === entry.groupKey) {
      last.entries.push(entry)
      continue
    }
    groups.push({
      groupKey: entry.groupKey,
      groupLabel: entry.groupLabel,
      entries: [entry],
    })
  }
  return groups
}

function relatedKeysFor(
  entry: IndexedEntry,
  flat: readonly IndexedEntry[],
  groupSize: ReadonlyMap<string, number>
): string[] {
  const keys: string[] = []
  const seen = new Set<string>()
  const push = (key: string) => {
    if (!key || key === entry.key || seen.has(key)) return
    seen.add(key)
    keys.push(key)
  }
  if ((groupSize.get(entry.groupKey) ?? 99) <= FAMILY_GROUP_MAX) {
    for (const other of flat) {
      if (other.groupKey === entry.groupKey) push(other.key)
    }
  }
  if (entry.href) {
    for (const related of getExplicitCreationRelatedLinks(entry.href)) {
      const path = normalizeFeaturePath(related.href)
      const match = flat.find((row) => row.href && normalizeFeaturePath(row.href) === path)
      if (match) push(match.key)
    }
  }
  return keys
}

/**
 * Tính năng vừa mở (mới nhất trước) đứng trên.
 * Tính năng ít mở giữ thứ tự catalog ở giữa.
 * Tính năng liên quan với mục vừa mở đứng dưới.
 */
export function rankHubFeaturePickerGroups(
  groups: readonly HubFeaturePickerGroup[],
  recentKeys: readonly string[]
): HubFeaturePickerGroup[] {
  const recent = recentKeys.map((key) => key.trim()).filter(Boolean)
  if (recent.length === 0) return groups.map((group) => ({ ...group, entries: [...group.entries] }))

  const flat: IndexedEntry[] = []
  const groupSize = new Map<string, number>()
  for (const group of groups) {
    groupSize.set(group.groupKey, group.entries.length)
    for (const entry of group.entries) flat.push(entry)
  }
  const byKey = new Map(flat.map((entry) => [entry.key, entry]))
  const placed = new Set<string>()
  const top: IndexedEntry[] = []
  const related: IndexedEntry[] = []

  const take = (key: string, bucket: IndexedEntry[]) => {
    if (placed.has(key)) return
    const row = byKey.get(key)
    if (!row) return
    placed.add(key)
    bucket.push(row)
  }

  for (const key of recent) take(key, top)
  for (const key of recent) {
    const entry = byKey.get(key)
    if (!entry) continue
    for (const relatedKey of relatedKeysFor(entry, flat, groupSize)) take(relatedKey, related)
  }

  const cold: IndexedEntry[] = flat.filter((entry) => !placed.has(entry.key))
  return [...chunkGroups(top), ...chunkGroups(cold), ...chunkGroups(related)]
}
