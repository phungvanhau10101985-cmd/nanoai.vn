import {
  getStepGenerator,
  type StudioGeneratorKind,
} from '@/lib/hub-chat/hub-studio-presets'
import {
  isDiscoveryStep,
  normalizeLandingDesignStepKey,
} from '@/lib/hub-chat/hub-studio-preset-flows'
import type { HubStudioSession } from '@/lib/hub-chat/hub-studio-types'

export type CurrentStudioDesignStep = {
  presetId: string
  stepKey: string
  generator: StudioGeneratorKind
}

function resolveDesignStepKey(session: HubStudioSession): string | null {
  const raw = session.currentStepKey
  if (!raw) return null
  if (session.presetId === 'landing_page') {
    return normalizeLandingDesignStepKey(raw) ?? raw
  }
  return raw
}

/** Resolve execution exclusively from the persisted current step. */
export function resolveCurrentStudioDesignStep(
  session: HubStudioSession
): CurrentStudioDesignStep | null {
  const presetId = session.presetId
  const stepKey = resolveDesignStepKey(session)
  if (
    !presetId ||
    !stepKey ||
    !session.discoveryComplete ||
    isDiscoveryStep(presetId, stepKey)
  ) {
    return null
  }
  const generator = getStepGenerator(presetId, stepKey)
  return generator ? { presetId, stepKey, generator } : null
}

/** A normal design message only updates the current step brief. */
export function saveCurrentStudioStepBrief(
  session: HubStudioSession,
  message: string
): HubStudioSession {
  let stepKey = session.currentStepKey
  if (session.presetId === 'landing_page' && stepKey) {
    stepKey = normalizeLandingDesignStepKey(stepKey) ?? stepKey
  }
  const value = message.trim()
  if (!stepKey || value.length < 2) return session
  return {
    ...session,
    currentStepKey: stepKey,
    briefNotes: {
      ...session.briefNotes,
      [stepKey]: value,
    },
  }
}
