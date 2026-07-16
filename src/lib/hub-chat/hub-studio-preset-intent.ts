import type { WebLocale } from '@/lib/i18n/config'
import {
  buildStepsFromPreset,
  getPresetKickoff,
  getStepAskPrompt,
  isDiscoveryStep,
  presetTitle,
  STUDIO_PRESETS,
} from '@/lib/hub-chat/hub-studio-presets'
import type { HubStudioProcessStep, HubStudioSession } from '@/lib/hub-chat/hub-studio-types'

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

export function firstIncompleteStepKey(steps: HubStudioProcessStep[]): string | null {
  return steps.find((s) => s.status !== 'done')?.key ?? null
}

export function getActiveStepKey(session: HubStudioSession | null | undefined): string | null {
  if (!session) return null
  const steps = Array.isArray(session.processSteps) ? session.processSteps : []
  if (!steps.length) return session.currentStepKey ?? null
  if (session.currentStepKey) {
    const current = steps.find((s) => s.key === session.currentStepKey)
    if (current && current.status !== 'done') return session.currentStepKey
  }
  return (
    steps.find((s) => s.status === 'in_progress')?.key ??
    firstIncompleteStepKey(steps)
  )
}

/** Removed from flow — print content is collected per face at design time. */
const OBSOLETE_PACKAGING_STEP_KEYS = new Set(['print_content'])

function stripObsoletePackagingSteps(session: HubStudioSession): HubStudioSession {
  if (session.presetId !== 'packaging_kit') return session
  const filtered = session.processSteps.filter((s) => !OBSOLETE_PACKAGING_STEP_KEYS.has(s.key))
  if (filtered.length === session.processSteps.length) return session
  const currentKey =
    session.currentStepKey && OBSOLETE_PACKAGING_STEP_KEYS.has(session.currentStepKey)
      ? null
      : session.currentStepKey
  return { ...session, processSteps: filtered, currentStepKey: currentKey }
}

/** Keep discovery on the first unanswered brief step — AI must not skip ahead. */
export function syncDiscoveryCurrentStep(session: HubStudioSession): HubStudioSession {
  session = stripObsoletePackagingSteps(session)
  if (!session.presetId || session.discoveryComplete || !session.processSteps.length) return session
  const firstPendingKey = firstIncompleteStepKey(session.processSteps)
  if (!firstPendingKey) return session
  if (session.currentStepKey === firstPendingKey) {
    const inProgress = session.processSteps.some(
      (s) => s.key === firstPendingKey && s.status === 'in_progress'
    )
    if (inProgress) return session
  }
  return {
    ...session,
    currentStepKey: firstPendingKey,
    processSteps: session.processSteps.map((s) => ({
      ...s,
      status:
        s.status === 'done'
          ? ('done' as const)
          : s.key === firstPendingKey
            ? ('in_progress' as const)
            : ('pending' as const),
    })),
  }
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
    packaging:
      id === 'packaging_kit'
        ? { version: 2, dimensionsMm: null, faces: {} }
        : session.packaging,
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

export function appendCurrentDiscoveryAsk(
  reply: string,
  locale: WebLocale,
  session: HubStudioSession
): string {
  if (!session.presetId || session.discoveryComplete) return reply
  const stepKey = getActiveStepKey(session)
  if (!stepKey || !isDiscoveryStep(session.presetId, stepKey)) return reply
  return appendFirstStepAsk(reply, locale, session.presetId, stepKey)
}
