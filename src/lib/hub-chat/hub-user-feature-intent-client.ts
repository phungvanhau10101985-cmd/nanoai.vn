import { resolveHubFeatureSelection } from '@/lib/hub-chat/hub-feature-catalog'
import { matchFeatureFlowByMessage } from '@/lib/hub-chat/hub-feature-flow-registry'
import {
  detectStudioFlowSwitch,
  FLOW_SWITCH_AI_MIN_CONFIDENCE,
  isActiveStudioFlow,
  shouldSkipFlowSwitchAiClassification,
} from '@/lib/hub-chat/hub-studio-flow-guard'
import type { HubStudioSession } from '@/lib/hub-chat/hub-studio-types'
import type { WebLocale } from '@/lib/i18n/config'

export type UserFeatureIntentResult =
  | { action: 'studio_switch'; presetId: string }
  | {
      action: 'open_standalone'
      href: string
      label: string
      prefillPrompt: string
    }

type FeatureIntentApiResponse = {
  ok?: boolean
  featureIntent?: {
    featureKey?: string | null
    confidence?: number
  }
}

const MIN_RULE_STANDALONE_SCORE = 8

function ruleMatchToIntent(
  message: string,
  locale: WebLocale,
  session: HubStudioSession | null | undefined
): UserFeatureIntentResult | null {
  const trimmed = message.trim()
  if (!trimmed) return null

  if (isActiveStudioFlow(session)) {
    const presetSwitch = detectStudioFlowSwitch(trimmed, session!.presetId)
    if (presetSwitch) return { action: 'studio_switch', presetId: presetSwitch }
  }

  if (shouldSkipFlowSwitchAiClassification(trimmed)) return null

  const featureMatch = matchFeatureFlowByMessage(trimmed, locale)
  if (!featureMatch) return null

  if (featureMatch.kind === 'standalone' && featureMatch.score >= MIN_RULE_STANDALONE_SCORE) {
    return {
      action: 'open_standalone',
      href: featureMatch.href,
      label: featureMatch.label,
      prefillPrompt: trimmed,
    }
  }

  if (
    featureMatch.kind === 'studio' &&
    featureMatch.score >= 10 &&
    featureMatch.presetId !== session?.presetId
  ) {
    return { action: 'studio_switch', presetId: featureMatch.presetId }
  }

  return null
}

function selectionToIntent(
  selection: ReturnType<typeof resolveHubFeatureSelection>,
  message: string,
  session: HubStudioSession | null | undefined
): UserFeatureIntentResult | null {
  if (!selection) return null
  if (selection.kind === 'standalone') {
    return {
      action: 'open_standalone',
      href: selection.href,
      label: selection.label,
      prefillPrompt: message.trim(),
    }
  }
  if (selection.kind === 'studio' && selection.presetId !== session?.presetId) {
    return { action: 'studio_switch', presetId: selection.presetId }
  }
  return null
}

/**
 * Rule-first, AI-fallback feature intent while user sends a message.
 * Returns null → continue the current inline flow / normal message handling.
 */
export async function resolveUserFeatureIntent(input: {
  message: string
  session: HubStudioSession | null | undefined
  locale: WebLocale
  threadId: string | null
}): Promise<UserFeatureIntentResult | null> {
  const trimmed = input.message.trim()
  if (!trimmed) return null

  const ruleIntent = ruleMatchToIntent(trimmed, input.locale, input.session)
  if (ruleIntent) return ruleIntent

  if (shouldSkipFlowSwitchAiClassification(trimmed)) return null

  try {
    const res = await fetch('/api/hub-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        mode: 'studio',
        locale: input.locale,
        threadId: input.threadId,
        message: trimmed,
        action: 'classify_feature_intent',
      }),
    })
    const data = (await res.json().catch(() => ({}))) as FeatureIntentApiResponse
    if (!data.ok) return null

    const featureKey = String(data.featureIntent?.featureKey ?? '').trim()
    const confidence = Number(data.featureIntent?.confidence ?? 0)
    if (!featureKey || confidence < FLOW_SWITCH_AI_MIN_CONFIDENCE) return null

    const selection = resolveHubFeatureSelection(featureKey, input.locale)
    return selectionToIntent(selection, trimmed, input.session)
  } catch {
    return null
  }
}
