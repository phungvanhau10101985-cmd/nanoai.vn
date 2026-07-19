import { buildHubToolCatalog } from '@/lib/hub-chat/hub-chat-catalog'
import {
  buildStandaloneFeatureEntries,
  type HubFeatureFlowKind,
  type HubFeatureFlowMatch,
} from '@/lib/hub-chat/hub-feature-flow-registry'
import { STUDIO_PRESETS, presetTitle } from '@/lib/hub-chat/hub-studio-presets'
import type { NavGroupKey, ToolKey } from '@/lib/i18n/dictionaries'
import type { WebLocale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'

export type HubFeatureCatalogEntry = {
  key: string
  kind: HubFeatureFlowKind
  presetId?: string
  href?: string
  label: string
  labelKey: string
  groupKey: string
  groupLabel: string
}

const STUDIO_GROUP_KEY = 'studio_inline' as const

export function studioFeatureKey(presetId: string): string {
  return `studio:${presetId}`
}

export function toolFeatureKey(href: string): string {
  return `tool:${href}`
}

/** Full programmatic catalog: inline studio presets + standalone tool pages. */
export function buildHubFeatureCatalog(locale: WebLocale): HubFeatureCatalogEntry[] {
  const t = getDictionary(locale)
  const studioGroupLabel = t.hubChat.featureGroupStudioInline
  const out: HubFeatureCatalogEntry[] = []

  for (const preset of STUDIO_PRESETS) {
    out.push({
      key: studioFeatureKey(preset.id),
      kind: 'studio',
      presetId: preset.id,
      label: presetTitle(locale, preset.id),
      labelKey: preset.labelKey,
      groupKey: STUDIO_GROUP_KEY,
      groupLabel: studioGroupLabel,
    })
  }

  const toolCatalog = buildHubToolCatalog(t.tool, t.navGroup)
  const groupByHref = new Map(toolCatalog.map((row) => [row.href, row]))

  for (const tool of buildStandaloneFeatureEntries(locale)) {
    const meta = groupByHref.get(tool.href)
    out.push({
      key: toolFeatureKey(tool.href),
      kind: 'standalone',
      href: tool.href,
      label: tool.label,
      labelKey: tool.labelKey,
      groupKey: meta?.groupKey ?? 'design_creative',
      groupLabel: meta?.groupLabel ?? t.navGroup.design_creative,
    })
  }

  return out
}

export function getHubFeatureCatalogEntry(
  locale: WebLocale,
  key: string
): HubFeatureCatalogEntry | undefined {
  const normalized = key.trim()
  if (!normalized) return undefined
  return buildHubFeatureCatalog(locale).find((entry) => entry.key === normalized)
}

/** Deterministic routing when user picks a catalog chip — no AI inference. */
export function resolveHubFeatureSelection(
  key: string,
  locale: WebLocale
): HubFeatureFlowMatch | null {
  const entry = getHubFeatureCatalogEntry(locale, key)
  if (!entry) return null
  if (entry.kind === 'studio' && entry.presetId) {
    return { kind: 'studio', presetId: entry.presetId, score: 100 }
  }
  if (entry.kind === 'standalone' && entry.href) {
    return {
      kind: 'standalone',
      href: entry.href,
      labelKey: entry.labelKey as ToolKey,
      label: entry.label,
      score: 100,
    }
  }
  return null
}

export function buildFullFeatureCatalogForBrain(locale: WebLocale): string {
  return JSON.stringify(
    buildHubFeatureCatalog(locale).map((entry) => ({
      featureKey: entry.key,
      kind: entry.kind,
      presetId: entry.presetId ?? '',
      href: entry.href ?? '',
      label: entry.label,
      group: entry.groupLabel,
      flow: entry.kind === 'studio' ? 'studio_complete' : 'standalone_open_tool',
    }))
  )
}

export function groupHubFeatureCatalog(
  locale: WebLocale
): { groupKey: string; groupLabel: string; entries: HubFeatureCatalogEntry[] }[] {
  const groups = new Map<string, { groupLabel: string; entries: HubFeatureCatalogEntry[] }>()
  for (const entry of buildHubFeatureCatalog(locale)) {
    const row = groups.get(entry.groupKey)
    if (row) row.entries.push(entry)
    else groups.set(entry.groupKey, { groupLabel: entry.groupLabel, entries: [entry] })
  }
  const order: string[] = [STUDIO_GROUP_KEY, 'try_on', 'education', 'image_edit', 'design_creative', 'three_d_special', 'music_ai']
  const sorted = [...groups.entries()].sort((a, b) => {
    const ai = order.indexOf(a[0])
    const bi = order.indexOf(b[0])
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })
  return sorted.map(([groupKey, row]) => ({
    groupKey,
    groupLabel: row.groupLabel,
    entries: row.entries,
  }))
}

/** Feature chips after an inline flow completes — excludes the preset just finished. */
export function groupPostFlowFeatureCatalog(
  locale: WebLocale,
  completedPresetId?: string | null
): { groupKey: string; groupLabel: string; entries: HubFeatureCatalogEntry[] }[] {
  const presetId = String(completedPresetId ?? '').trim()
  return groupHubFeatureCatalog(locale)
    .map((group) => ({
      ...group,
      entries: presetId
        ? group.entries.filter((entry) => !(entry.kind === 'studio' && entry.presetId === presetId))
        : group.entries,
    }))
    .filter((group) => group.entries.length > 0)
}
