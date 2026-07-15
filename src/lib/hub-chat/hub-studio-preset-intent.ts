import type { WebLocale } from '@/lib/i18n/config'
import {
  buildStepsFromPreset,
  getPresetKickoff,
  getStepAskPrompt,
  presetTitle,
  STUDIO_PRESETS,
} from '@/lib/hub-chat/hub-studio-presets'
import type { HubStudioSession } from '@/lib/hub-chat/hub-studio-types'

export function isValidStudioPresetId(presetId: string | null | undefined): boolean {
  const id = String(presetId ?? '').trim()
  return Boolean(id && STUDIO_PRESETS.some((p) => p.id === id))
}

/** Rich preset list for Studio brain — AI picks suggestedPresetId from this catalog. */
export function buildPresetCatalogForBrain(locale: WebLocale): string {
  return STUDIO_PRESETS.map((p) => {
    const title = presetTitle(locale, p.id)
    const upload = p.needsUpload ? ' | needs_upload=true' : ''
    return `${p.id}: ${title}${upload}`
  }).join('\n')
}

export function applySuggestedPreset(
  session: HubStudioSession,
  locale: WebLocale,
  presetId: string
): HubStudioSession {
  const id = String(presetId).trim()
  if (!isValidStudioPresetId(id) || session.presetId || session.processSteps.length) {
    return session
  }
  const steps = buildStepsFromPreset(locale, id)
  return {
    ...session,
    presetId: id,
    projectTitle: session.projectTitle || presetTitle(locale, id),
    processSteps: steps,
    currentStepKey: steps[0]?.key ?? null,
    discoveryComplete: false,
    briefNotes: {},
  }
}

export function appendPresetKickoffIfNeeded(
  reply: string,
  locale: WebLocale,
  presetId: string,
  justStarted: boolean
): string {
  if (!justStarted) return reply
  const kickoff = getPresetKickoff(locale, presetId)
  if (reply.includes(presetTitle(locale, presetId))) return reply
  return `${reply}\n\n${kickoff}`
}

export function appendFirstStepAsk(
  reply: string,
  locale: WebLocale,
  presetId: string,
  stepKey: string | null
): string {
  if (!stepKey) return reply
  const ask = getStepAskPrompt(locale, presetId, stepKey)
  if (!ask || reply.includes(ask)) return reply
  return `${reply}\n\n${ask}`
}
