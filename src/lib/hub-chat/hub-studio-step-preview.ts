import { getFlowSteps } from '@/lib/hub-chat/hub-studio-presets'
import type { HubStudioMessagePayload, HubStudioSession } from '@/lib/hub-chat/hub-studio-types'
import { packagingStepKeyToSlot } from '@/lib/packaging/hub-face-steps'
import { resolveMockupSlotUrl } from '@/lib/packaging/box-face-slots'
import { packagingBarcodeIsReady } from '@/lib/packaging/packaging-barcode-form'

const PACKAGING_MOCKUP_STEP_KEY = 'box_mockup_3d'
const PACKAGING_ARTIFACT_STEP_KEYS = new Set(['box_mockup_3d', 'box_dieline_pdf'])

export function isPackagingMockupStepDone(session: HubStudioSession): boolean {
  return session.processSteps.some(
    (step) => step.key === PACKAGING_MOCKUP_STEP_KEY && step.status === 'done'
  )
}

/** Chat / generate stay hidden only while the current workflow step awaits Continue. */
export function pendingPreviewBlocksWorkflowInput(session: HubStudioSession): boolean {
  const pending = session.pendingPreview
  const workflowKey = session.currentStepKey
  if (!pending?.url || !workflowKey) return false
  if (pending.screenKey !== workflowKey) return false
  const pendingStep = session.processSteps.find((step) => step.key === pending.screenKey)
  if (pendingStep?.status === 'done') return false
  return true
}

/** Drop stale mockup/face pending before compositing PDF or mockup on a later step. */
export function clearStalePendingForArtifactGenerate(
  session: HubStudioSession,
  targetStepKey: string
): HubStudioSession {
  const pending = session.pendingPreview
  if (!pending) return session

  if (pendingPreviewBlocksWorkflowInput(session)) {
    if (
      PACKAGING_ARTIFACT_STEP_KEYS.has(targetStepKey) &&
      pending.screenKey === targetStepKey &&
      pending.url
    ) {
      return { ...session, pendingPreview: null }
    }
    return session
  }

  if (pending.screenKey !== targetStepKey) {
    return { ...session, pendingPreview: null }
  }

  return session
}

/** After editing an already-approved face, avoid stale pending blocking the workflow UI. */
export function resolveWorkflowPendingAfterApprovedFaceEdit(
  session: HubStudioSession,
  editedScreenKey: string,
  savedCurrentStepKey: string | null | undefined,
  savedPendingPreview: HubStudioSession['pendingPreview']
): HubStudioSession['pendingPreview'] {
  if (!savedPendingPreview) return null
  if (!savedCurrentStepKey || savedCurrentStepKey === editedScreenKey) {
    return savedPendingPreview
  }

  const editedStepDone =
    session.processSteps.find((step) => step.key === editedScreenKey)?.status === 'done'
  if (!editedStepDone) return savedPendingPreview

  if (savedPendingPreview.screenKey === 'box_mockup_3d') {
    if (isPackagingMockupStepDone(session)) return null
    if (session.packaging?.mockupUrl) {
      return { ...savedPendingPreview, url: session.packaging.mockupUrl }
    }
    return null
  }

  if (savedPendingPreview.screenKey === editedScreenKey) return null
  return null
}

/** View-only 3D mockup payload after user taps Continue (mockup is not a reference image). */
export function buildApprovedPackagingMockupStudio(
  session: HubStudioSession
): HubStudioMessagePayload | null {
  if (session.presetId !== 'packaging_kit') return null
  const mockupUrl = session.packaging?.mockupUrl
  if (!mockupUrl || !isPackagingMockupStepDone(session)) return null
  if (!session.packaging?.dimensionsMm) return null
  return {
    imageUrl: mockupUrl,
    screenKey: PACKAGING_MOCKUP_STEP_KEY,
    screenLabel: stepLabelFromSession(session, PACKAGING_MOCKUP_STEP_KEY),
    previewKind: 'image',
    processSteps: session.processSteps,
    showRegenerate: true,
    showApproveReference: false,
  }
}

export function mergeApprovedPackagingMockupIntoStudio(
  session: HubStudioSession,
  studio: HubStudioMessagePayload
): HubStudioMessagePayload {
  const mockup = buildApprovedPackagingMockupStudio(session)
  if (!mockup || studio.imageUrl) return studio
  return { ...studio, ...mockup }
}

function stepLabelFromSession(session: HubStudioSession, stepKey: string): string {
  return session.processSteps.find((s) => s.key === stepKey)?.label ?? stepKey
}

/** Restore pending preview when user navigates back to a step that already has output. */
export function resolveStepPendingPreview(
  session: HubStudioSession,
  presetId: string,
  stepKey: string
): HubStudioSession['pendingPreview'] {
  if (session.pendingPreview?.screenKey === stepKey) return session.pendingPreview

  const ref = session.referenceImages.find((r) => r.screenKey === stepKey)
  if (ref?.url) {
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

  if (presetId !== 'packaging_kit') return null

  const packaging = session.packaging
  const label = stepLabelFromSession(session, stepKey)
  const prompt =
    session.briefNotes[stepKey]?.trim() ||
    session.lastGenerationPrompt?.trim() ||
    label

  const slot = packagingStepKeyToSlot(stepKey)
  const faceUrl =
    slot && packaging?.faceSlots
      ? resolveMockupSlotUrl(slot, packaging.faceSlots)
      : null
  if (slot && faceUrl) {
    return {
      screenKey: stepKey,
      screenLabel: label,
      url: faceUrl,
      generationPrompt: prompt,
    }
  }

  if (stepKey === 'box_mockup_3d' && packaging?.mockupUrl) {
    return {
      screenKey: stepKey,
      screenLabel: label,
      url: packaging.mockupUrl,
      generationPrompt: prompt,
    }
  }

  if (stepKey === 'barcode_label' && packagingBarcodeIsReady(packaging)) {
    return {
      screenKey: stepKey,
      screenLabel: label,
      url: packaging?.barcodeUrl ?? packaging?.barcodeArtifacts?.[0]?.url ?? '',
      generationPrompt: prompt,
    }
  }

  return null
}

export function flowStepIndex(presetId: string, stepKey: string): number {
  return getFlowSteps(presetId).findIndex((s) => s.key === stepKey)
}

export function isStepAtOrBefore(presetId: string, stepKey: string, maxStepKey: string | null | undefined): boolean {
  if (!maxStepKey) return true
  const a = flowStepIndex(presetId, stepKey)
  const b = flowStepIndex(presetId, maxStepKey)
  if (a < 0 || b < 0) return false
  return a <= b
}
