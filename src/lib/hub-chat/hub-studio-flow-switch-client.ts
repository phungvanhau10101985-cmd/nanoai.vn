import {
  FLOW_SWITCH_AI_MIN_CONFIDENCE,
  shouldSkipFlowSwitchAiClassification,
} from '@/lib/hub-chat/hub-studio-flow-guard'
import { detectStudioFlowSwitch, isActiveStudioFlow } from '@/lib/hub-chat/hub-studio-flow-guard'
import type { HubStudioSession } from '@/lib/hub-chat/hub-studio-types'
import type { WebLocale } from '@/lib/i18n/config'

type FlowSwitchApiResponse = {
  ok?: boolean
  flowSwitch?: {
    switchPresetId?: string | null
    confidence?: number
  }
}

/**
 * Rule-first, AI-fallback flow switch detection while a Studio preset is active.
 * Returns a target preset id for the confirmation dialog, or null to continue normally.
 */
export async function resolveStudioFlowSwitch(input: {
  message: string
  session: HubStudioSession | null | undefined
  locale: WebLocale
  threadId: string | null
}): Promise<string | null> {
  const trimmed = input.message.trim()
  if (!trimmed || !isActiveStudioFlow(input.session)) return null

  const currentPresetId = input.session!.presetId
  const ruleMatch = detectStudioFlowSwitch(trimmed, currentPresetId)
  if (ruleMatch) return ruleMatch

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
        action: 'classify_flow_switch',
      }),
    })
    const data = (await res.json().catch(() => ({}))) as FlowSwitchApiResponse
    if (!data.ok) return null

    const switchPresetId = String(data.flowSwitch?.switchPresetId ?? '').trim() || null
    const confidence = Number(data.flowSwitch?.confidence ?? 0)
    if (!switchPresetId || confidence < FLOW_SWITCH_AI_MIN_CONFIDENCE) return null
    if (switchPresetId === currentPresetId) return null
    return switchPresetId
  } catch {
    return null
  }
}
