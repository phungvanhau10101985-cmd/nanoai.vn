import { getFlowSteps } from '@/lib/hub-chat/hub-studio-presets'
import type { HubStudioSession } from '@/lib/hub-chat/hub-studio-types'

export function getFurthestReachedStepIndex(session: HubStudioSession, presetId: string): number {
  const flow = getFlowSteps(presetId)
  let max = -1
  for (const step of session.processSteps) {
    if (step.status !== 'done' && step.status !== 'in_progress') continue
    const idx = flow.findIndex((f) => f.key === step.key)
    if (idx > max) max = idx
  }
  return max
}

export function canNavigateToStep(
  session: HubStudioSession,
  presetId: string,
  stepKey: string
): boolean {
  const flow = getFlowSteps(presetId)
  const targetIdx = flow.findIndex((s) => s.key === stepKey)
  if (targetIdx < 0) return false
  const proc = session.processSteps.find((s) => s.key === stepKey)
  if (!proc || proc.status === 'pending') return false
  const furthestIdx = getFurthestReachedStepIndex(session, presetId)
  return furthestIdx >= 0 && targetIdx <= furthestIdx
}

/** User is viewing/editing an earlier step while later steps remain done. */
export function isNavigatedBackEdit(session: HubStudioSession, presetId: string): boolean {
  if (!session.currentStepKey) return false
  const flow = getFlowSteps(presetId)
  const currentIdx = flow.findIndex((s) => s.key === session.currentStepKey)
  const furthestIdx = getFurthestReachedStepIndex(session, presetId)
  return currentIdx >= 0 && furthestIdx >= 0 && currentIdx < furthestIdx
}

export function navigateSessionToStep(
  session: HubStudioSession,
  presetId: string,
  stepKey: string
): HubStudioSession {
  const processSteps = session.processSteps.map((s) =>
    s.key === stepKey ? { ...s, status: 'in_progress' as const } : s
  )
  return {
    ...session,
    currentStepKey: stepKey,
    processSteps,
    pendingPreview: session.pendingPreview?.screenKey === stepKey ? session.pendingPreview : null,
    lastGenerationPrompt:
      session.pendingPreview?.screenKey === stepKey ? session.lastGenerationPrompt : null,
  }
}

export function focusSessionOnDesignStep(
  session: HubStudioSession,
  presetId: string,
  stepKey: string,
  message?: string
): HubStudioSession {
  const briefNotes =
    message && message.trim().length >= 2
      ? { ...session.briefNotes, [stepKey]: message.trim() }
      : session.briefNotes
  return {
    ...navigateSessionToStep(session, presetId, stepKey),
    briefNotes,
  }
}
