import type { HubChatThreadSummary } from '@/lib/db/hub-chat-pg'
import { buildHubFeatureCatalog, getHubFeatureCatalogEntry } from '@/lib/hub-chat/hub-feature-catalog'
import { presetTitle } from '@/lib/hub-chat/hub-studio-presets'
import { foldFeatureChatText } from '@/lib/hub-chat/shared-feature-open'
import type { WebLocale } from '@/lib/i18n/config'

const PLACEHOLDER_TITLES = new Set(['studio', 'nanoai chat'])

export function isHubThreadPlaceholderTitle(title: string | null | undefined): boolean {
  const trimmed = title?.trim().toLowerCase() ?? ''
  return !trimmed || PLACEHOLDER_TITLES.has(trimmed)
}

/** Title stored when a hub thread is created. Feature chips use the catalog label, not "Studio". */
export function hubThreadCreateTitle(input: {
  action: string
  locale: WebLocale
  presetId?: string
  featureKey?: string
  message?: string
}): string {
  const presetId = input.presetId?.trim() ?? ''
  if (input.action === 'start_preset' && presetId) {
    return presetTitle(input.locale, presetId).slice(0, 80)
  }
  const featureKey = input.featureKey?.trim() ?? ''
  if (input.action === 'select_feature' && featureKey) {
    const label = getHubFeatureCatalogEntry(input.locale, featureKey)?.label?.trim()
    if (label) return label.slice(0, 80)
  }
  if (input.action === 'classify_flow_switch' || input.action === 'classify_feature_intent') {
    return 'Studio'
  }
  return input.message?.trim().slice(0, 80) || 'Studio'
}

/** Longest catalog feature name contained in the conversation text. */
export function featureLabelInHubText(text: string | null | undefined, locale: WebLocale): string | null {
  const folded = foldFeatureChatText(text ?? '')
  if (!folded) return null
  let best: { label: string; len: number } | null = null
  for (const entry of buildHubFeatureCatalog(locale)) {
    const labelFold = foldFeatureChatText(entry.label)
    const compact = labelFold.replace(/ /g, '')
    if (compact.length < 4) continue
    if (!folded.includes(labelFold)) continue
    if (!best || labelFold.length > best.len) best = { label: entry.label, len: labelFold.length }
  }
  return best?.label ?? null
}

type HubThreadLabelInput = Pick<
  HubChatThreadSummary,
  'title' | 'presetId' | 'projectTitle' | 'firstUserMessage' | 'lastMessagePreview'
>

/** Sidebar title: feature name when the stored title is still the generic placeholder. */
export function hubThreadListLabel(thread: HubThreadLabelInput, locale: WebLocale): string {
  const project = thread.projectTitle?.trim() ?? ''
  if (project && !isHubThreadPlaceholderTitle(project)) return project

  const stored = thread.title.trim()
  if (stored && !isHubThreadPlaceholderTitle(stored)) return stored

  const presetId = thread.presetId?.trim()
  if (presetId) {
    const titled = presetTitle(locale, presetId).trim()
    if (titled) return titled
  }

  const fromFirst = featureLabelInHubText(thread.firstUserMessage, locale)
  if (fromFirst) return fromFirst
  const fromPreview = featureLabelInHubText(thread.lastMessagePreview, locale)
  if (fromPreview) return fromPreview

  const first = thread.firstUserMessage?.trim()
  if (first) return first.slice(0, 80)
  const preview = thread.lastMessagePreview?.trim()
  if (preview) return preview.slice(0, 80)
  return stored || 'NanoAI chat'
}
