import { getFlowSteps } from '@/lib/hub-chat/hub-studio-presets'
import {
  resolveStepPendingPreview,
} from '@/lib/hub-chat/hub-studio-step-preview'
import type { HubStudioSession } from '@/lib/hub-chat/hub-studio-types'

export function pendingPreviewFromApprovedReference(
  session: HubStudioSession,
  stepKey: string,
  presetId?: string | null
): HubStudioSession['pendingPreview'] {
  if (session.pendingPreview?.screenKey === stepKey) return session.pendingPreview
  if (!presetId) {
    const ref = session.referenceImages.find((r) => r.screenKey === stepKey)
    if (!ref?.url) return null
    return {
      screenKey: stepKey,
      screenLabel: ref.screenLabel,
      url: ref.url,
      generationPrompt:
        session.briefNotes[stepKey]?.trim() ||
        session.lastGenerationPrompt?.trim() ||
        ref.screenLabel,
    }
  }
  return resolveStepPendingPreview(session, presetId, stepKey)
}

export function getFurthestReachedStepIndex(session: HubStudioSession, presetId: string): number {
  const flow = session.processSteps.length ? session.processSteps : getFlowSteps(presetId)
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
  const flow = session.processSteps.length ? session.processSteps : getFlowSteps(presetId)
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
  const flow = session.processSteps.length ? session.processSteps : getFlowSteps(presetId)
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
  const pendingPreview = pendingPreviewFromApprovedReference(
    { ...session, processSteps, currentStepKey: stepKey },
    stepKey,
    presetId
  )
  return {
    ...session,
    currentStepKey: stepKey,
    processSteps,
    pendingPreview,
    lastGenerationPrompt:
      pendingPreview?.generationPrompt ?? session.lastGenerationPrompt,
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
