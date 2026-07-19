import type { HubStudioSession } from '@/lib/hub-chat/hub-studio-types'
import {
  getFlowSteps,
  isDiscoveryStep,
} from '@/lib/hub-chat/hub-studio-presets'
import { applyDiscoveryBriefEdit } from '@/lib/hub-chat/hub-studio-discovery-edit'
import { invalidatePackagingFromStep } from '@/lib/packaging/session-dependencies'
import { isPackagingFaceReEdit } from '@/lib/packaging/hub-face-steps'
import { resolveWorkflowPendingAfterApprovedFaceEdit } from '@/lib/hub-chat/hub-studio-step-preview'

export function isInPlacePackagingImageEdit(
  session: HubStudioSession,
  presetId: string,
  stepKey: string
): boolean {
  return presetId === 'packaging_kit' && isPackagingFaceReEdit(session, stepKey)
}

export function restoreTimelineAfterInPlaceImageEdit(
  updated: HubStudioSession,
  original: HubStudioSession,
  editedStepKey: string
): HubStudioSession {
  const preservePending = original.pendingPreview?.screenKey !== editedStepKey
  let pendingPreview = preservePending ? original.pendingPreview : null

  if (preservePending && pendingPreview) {
    pendingPreview = resolveWorkflowPendingAfterApprovedFaceEdit(
      updated,
      editedStepKey,
      original.currentStepKey,
      pendingPreview
    )
  }

  return {
    ...updated,
    processSteps: original.processSteps,
    currentStepKey: original.currentStepKey,
    pendingPreview,
    lastGenerationPrompt: preservePending && pendingPreview ? original.lastGenerationPrompt : null,
    generationSelection: original.generationSelection,
  }
}

export function rewindSessionForStepEdit(
  session: HubStudioSession,
  presetId: string,
  stepKey: string,
  newMessage: string
): HubStudioSession {
  const flow = getFlowSteps(presetId)
  const targetIdx = flow.findIndex((s) => s.key === stepKey)
  if (targetIdx < 0) return session

  const downstreamKeys = new Set(flow.slice(targetIdx).map((s) => s.key))
  const briefNotes = { ...session.briefNotes, [stepKey]: newMessage.trim() }

  const processSteps = session.processSteps.map((s) => {
    const idx = flow.findIndex((f) => f.key === s.key)
    if (idx < targetIdx) return { ...s, status: 'done' as const }
    if (s.key === stepKey) return { ...s, status: 'in_progress' as const }
    return { ...s, status: 'pending' as const }
  })

  let next: HubStudioSession = {
    ...session,
    briefNotes,
    processSteps,
    currentStepKey: stepKey,
    referenceImages: session.referenceImages.filter((r) => !downstreamKeys.has(r.screenKey)),
    pendingPreview: null,
    lastGenerationPrompt: null,
    generationSelection: undefined,
  }

  const stepDef = flow[targetIdx]
  if (presetId === 'packaging_kit' && stepDef?.phase === 'design') {
    next = invalidatePackagingFromStep(next, stepKey)
    next.briefNotes = briefNotes
  }

  const discoveryKeys = flow.filter((s) => s.phase === 'discovery').map((s) => s.key)
  next.discoveryComplete = discoveryKeys.every((k) => {
    const st = next.processSteps.find((s) => s.key === k)
    return st?.status === 'done'
  })

  if (isDiscoveryStep(presetId, stepKey) && newMessage.trim().length >= 2) {
    next = applyDiscoveryBriefEdit(next, presetId, stepKey, newMessage, { reopenStep: true })
  }

  return next
}

export function inferStepKeyForUserMessage(
  messages: { role: string; studio?: { stepKey?: string } | null }[],
  messageIndex: number,
  presetId: string
): string | null {
  const msg = messages[messageIndex]
  if (!msg || msg.role !== 'user') return null
  if (msg.studio?.stepKey) return msg.studio.stepKey

  const flow = getFlowSteps(presetId)
  if (!flow.length) return null

  const userIndexes: number[] = []
  for (let i = 0; i < messages.length; i++) {
    if (messages[i]?.role === 'user') userIndexes.push(i)
  }
  const userOrdinal = userIndexes.indexOf(messageIndex)
  if (userOrdinal < 0) return null

  // First user line is often preset title from start_preset — cannot infer step safely
  if (userOrdinal === 0) return null

  const flowIndex = userOrdinal - 1
  if (flowIndex < flow.length) return flow[flowIndex]!.key
  return flow[flow.length - 1]?.key ?? null
}

const CLIENT_TEMP_MESSAGE_ID = /^u-\d+$/

export function resolveEditUserMessage(
  messages: { id: string; role: string; studio?: { stepKey?: string } | null; createdAt?: string }[],
  editMessageId: string,
  editStepKey: string,
  presetId: string
): { id: string; index: number; createdAt: string } | null {
  if (!CLIENT_TEMP_MESSAGE_ID.test(editMessageId)) {
    const idx = messages.findIndex((m) => m.id === editMessageId)
    const row = messages[idx]
    if (row?.role === 'user' && row.createdAt) {
      return { id: row.id, index: idx, createdAt: row.createdAt }
    }
  }

  if (editStepKey) {
    for (let i = messages.length - 1; i >= 0; i--) {
      const row = messages[i]
      if (row?.role === 'user' && row.studio?.stepKey === editStepKey && row.createdAt) {
        return { id: row.id, index: i, createdAt: row.createdAt }
      }
    }
    for (let i = messages.length - 1; i >= 0; i--) {
      const row = messages[i]
      if (row?.role !== 'user' || !row.createdAt) continue
      const inferred = inferStepKeyForUserMessage(messages, i, presetId)
      if (inferred === editStepKey) {
        return { id: row.id, index: i, createdAt: row.createdAt }
      }
    }
  }

  return null
}
