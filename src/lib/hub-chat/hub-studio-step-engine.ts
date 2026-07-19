import {
  getStepGenerator,
  type StudioGeneratorKind,
} from '@/lib/hub-chat/hub-studio-presets'
import { isDiscoveryStep } from '@/lib/hub-chat/hub-studio-preset-flows'
import type { HubStudioSession } from '@/lib/hub-chat/hub-studio-types'

export type CurrentStudioDesignStep = {
  presetId: string
  stepKey: string
  generator: StudioGeneratorKind
}

/** Resolve execution exclusively from the persisted current step. */
export function resolveCurrentStudioDesignStep(
  session: HubStudioSession
): CurrentStudioDesignStep | null {
  const presetId = session.presetId
  const stepKey = session.currentStepKey
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
  const stepKey = session.currentStepKey
  const value = message.trim()
  if (!stepKey || value.length < 2) return session
  return {
    ...session,
    briefNotes: {
      ...session.briefNotes,
      [stepKey]: value,
    },
  }
}
