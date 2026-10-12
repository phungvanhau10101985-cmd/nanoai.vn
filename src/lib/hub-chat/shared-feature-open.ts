import type { WebLocale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import type { HubChatWorkflowSuggestion } from '@/lib/hub-chat/hub-advisory'
import {
  getStandaloneFeatureByHref,
  isBroadStudyHelpIntent,
  isCatalogPhotoHubPreset,
  matchCatalogPhotoExportFlow,
  resolveIdleFeatureMatch,
  STUDY_HELP_FEATURE_HREFS,
  type HubFeatureFlowMatch,
} from '@/lib/hub-chat/hub-feature-flow-registry'
import { presetTitle } from '@/lib/hub-chat/hub-studio-presets'
import { hubPresetLaunchHref } from '@/lib/hub-chat/hub-studio-launch'

export type SharedFeatureOpenKind = 'feature_page' | 'hub'

export type SharedFeatureOpenTarget = {
  kind: SharedFeatureOpenKind
  href: string
  label: string
  buttonLabel: string
  presetId?: string
}

export type SharedFeatureOpenReply = {
  message: string
  open: SharedFeatureOpenTarget
}

const PAUSE_RE =
  /^(ok|okay|cam on|thanks|thank you|thoi|thoi nhe|khong can|bye|tam biet)( nhe| a| ban| shop| em)?$/

export function foldFeatureChatText(value: string): string {
  return value
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Cảm ơn / thôi — không phải ý định mở tính năng. */
export function isFeatureChatPause(text: string): boolean {
  const folded = foldFeatureChatText(text)
  return Boolean(folded) && PAUSE_RE.test(folded)
}

function openHint(locale: WebLocale, feature: string): string {
  return getDictionary(locale).hubChat.featureOpenHint.replace('{feature}', feature)
}

function openButton(locale: WebLocale): string {
  return getDictionary(locale).hubChat.advisoryOpenFeature
}

/** Cùng một đoạn nhắc + một đích mở, cho hub chat và shop ngành CNTT. */
export function sharedFeatureOpenFromMatch(
  match: HubFeatureFlowMatch,
  locale: WebLocale
): SharedFeatureOpenReply {
  if (match.kind === 'studio' && isCatalogPhotoHubPreset(match.presetId)) {
    return sharedFeatureOpenFromMatch(matchCatalogPhotoExportFlow(locale), locale)
  }
  if (match.kind === 'standalone') {
    return {
      message: openHint(locale, match.label),
      open: {
        kind: 'feature_page',
        href: match.href,
        label: match.label,
        buttonLabel: openButton(locale),
      },
    }
  }
  const label = presetTitle(locale, match.presetId)
  return {
    message: openHint(locale, label),
    open: {
      kind: 'hub',
      href: hubPresetLaunchHref(match.presetId),
      label,
      buttonLabel: openButton(locale),
      presetId: match.presetId,
    },
  }
}

export function resolveSharedFeatureOpen(
  message: string,
  locale: WebLocale,
  recentContext?: string
): SharedFeatureOpenReply | null {
  const match = resolveIdleFeatureMatch(message, locale, recentContext)
  if (!match) return null
  return sharedFeatureOpenFromMatch(match, locale)
}

export type StudyHelpMenu = {
  message: string
  opens: SharedFeatureOpenTarget[]
}

/** Các nút học bài khi khách nói «Giúp tôi học bài» mà chưa gọi tên một công cụ. */
export function studyHelpOpenTargets(locale: WebLocale): SharedFeatureOpenTarget[] {
  const presetLesson = getDictionary(locale).hubChat.studyHelpPresetLesson
  const opens: SharedFeatureOpenTarget[] = []
  for (const href of STUDY_HELP_FEATURE_HREFS) {
    const entry = getStandaloneFeatureByHref(locale, href)
    if (!entry) continue
    const label = href === '/hoc-bai-hoc-co-san' ? presetLesson : entry.label
    opens.push({
      kind: 'feature_page',
      href,
      label,
      buttonLabel: label,
    })
  }
  return opens
}

export function resolveStudyHelpMenu(message: string, locale: WebLocale): StudyHelpMenu | null {
  if (!isBroadStudyHelpIntent(message)) return null
  const opens = studyHelpOpenTargets(locale)
  if (!opens.length) return null
  return {
    message: getDictionary(locale).partnerGuestChat.studyHelpPickHint,
    opens,
  }
}

export function sharedFeatureOpenToWorkflow(
  shared: SharedFeatureOpenReply,
  prefill = ''
): HubChatWorkflowSuggestion {
  const open = shared.open
  return {
    href: open.href,
    labelKey: open.kind === 'hub' ? (open.presetId ?? 'hub') : open.href,
    label: open.label,
    reason: '',
    prefillPrompt: open.kind === 'feature_page' ? prefill.trim() : '',
    confidence: 1,
    flowKind: open.kind === 'hub' ? 'studio' : 'standalone',
    requiresOpenConfirm: open.kind === 'feature_page',
    studioPresetId: open.presetId,
    buttonLabel: open.buttonLabel,
  }
}

export function absoluteSharedFeatureHref(href: string, origin: string): string {
  const raw = href.trim()
  if (/^https?:\/\//i.test(raw)) return raw
  const base = origin.replace(/\/$/, '')
  return `${base}${raw.startsWith('/') ? raw : `/${raw}`}`
}
